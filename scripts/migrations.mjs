// Runner de db/migrations. Sem dependências além do node e do `pg` (o CLI importa o client).
//
// Segurança: o nome do arquivo e o checksum só entram no SQL como parâmetros ($1, $2).
// O texto executado é o arquivo já validado em db/migrations, nunca uma string montada
// com entrada externa. A URL de conexão não é registrada.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const MIGRATION_LOCK_KEY = "814002013";
export const MIGRATION_FILENAME = /^[0-9]{4}_[a-z0-9_]+\.sql$/;

const IDENT = /^[a-z_][a-z0-9_]*$/;

// Objeto que prova que a migração já foi aplicada, para o baseline não reexecutar SQL.
// Arquivo sem entrada aqui não é marcado: o baseline para antes dele.
export const SENTINELS = Object.freeze({
  "0001_init.sql": Object.freeze({ kind: "table", name: "users" }),
  "0002_link_layout_size.sql": Object.freeze({ kind: "column", table: "links", name: "layout" }),
  "0003_auth_security.sql": Object.freeze({ kind: "table", name: "auth_attempts" }),
  "0004_billing.sql": Object.freeze({ kind: "table", name: "subscriptions" }),
  "0005_metrics.sql": Object.freeze({ kind: "column", table: "events", name: "utm_campaign" }),
  "0006_billing_checkouts.sql": Object.freeze({ kind: "table", name: "billing_checkouts" }),
  "0007_initial_colors.sql": Object.freeze({ kind: "column", table: "profiles", name: "initial_bg_color" }),
  "0008_user_details.sql": Object.freeze({ kind: "column", table: "users", name: "first_name" }),
  "0009_whatsapp_style.sql": Object.freeze({ kind: "column", table: "profiles", name: "whatsapp_style" }),
  "0010_email_verification.sql": Object.freeze({ kind: "column", table: "users", name: "email_verified_at" }),
  "0011_cover_image.sql": Object.freeze({ kind: "column", table: "profiles", name: "cover_image_id" }),
  "0012_search_indexing.sql": Object.freeze({ kind: "column", table: "profiles", name: "search_indexing" }),
  "0013_show_avatar.sql": Object.freeze({ kind: "column", table: "profiles", name: "show_avatar" }),
  "0014_forms.sql": Object.freeze({ kind: "table", name: "forms" }),
  "0015_form_builder.sql": Object.freeze({ kind: "column", table: "users", name: "forms_enabled" }),
  "0016_public_response_version.sql": Object.freeze({ kind: "column", table: "form_responses", name: "public_version" }),
  "0017_profile_socials.sql": Object.freeze({ kind: "column", table: "profiles", name: "social_links" }),
  "0019_plan_tier.sql": Object.freeze({ kind: "column", table: "subscriptions", name: "plan" }),
  "0020_pix_block.sql": Object.freeze({ kind: "column", table: "links", name: "config" }),
});

const CREATE_MIGRATIONS_TABLE = `create table if not exists schema_migrations (
  name text primary key,
  checksum text,
  applied_at timestamptz not null default now()
)`;

const ADD_CHECKSUM_COLUMN = "alter table schema_migrations add column if not exists checksum text";

const FORBIDDEN_SQL = [
  [/^\s*begin\b/im, "BEGIN"],
  [/^\s*commit\b/im, "COMMIT"],
  [/^\s*rollback\b/im, "ROLLBACK"],
  [/^\s*end\s*;/im, "END"],
  [/\bcreate\s+(unique\s+)?index\s+concurrently\b/i, "CREATE INDEX CONCURRENTLY"],
  [/^\s*vacuum\b/im, "VACUUM"],
];

export function checksumOf(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function redactSecrets(text) {
  return String(text)
    .replace(/postgres(?:ql)?:\/\/[^\s'")]+/gi, "postgresql://[redacted]")
    .replace(/\b(password|pwd|sslpassword)=([^\s&]+)/gi, "$1=[redacted]");
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isPooledConnectionString(url) {
  const parsed = parsePostgresUrl(url);
  if (!parsed) return false;
  return pooledReason(parsed) !== null;
}

function parsePostgresUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function pooledReason(parsed) {
  const host = parsed.hostname.toLowerCase();
  if (host.includes("-pooler") || host.includes("pooler.")) return "host";
  if (parsed.port === "6543") return "port";
  const bouncer = parsed.searchParams.get("pgbouncer");
  if (bouncer !== null && bouncer.toLowerCase() !== "false" && bouncer !== "0") return "pgbouncer";
  return null;
}

function assertDirect(url, name) {
  const parsed = parsePostgresUrl(url);
  if (!parsed || (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") || !parsed.hostname) {
    throw new Error(`${name} não é uma URL postgresql válida`);
  }
  if (pooledReason(parsed)) {
    throw new Error(
      `${name} aponta para um pooler. Migrações exigem conexão direta (sem -pooler e sem porta 6543) para o lock de sessão valer. Defina DATABASE_URL_MIGRATIONS com a URL direta do Neon.`,
    );
  }
}

// DATABASE_URL_MIGRATIONS, senão a URL direta conhecida, senão DATABASE_URL se ela mesma não for pooler.
export function resolveMigrationUrl(env) {
  const dedicated = clean(env.DATABASE_URL_MIGRATIONS);
  if (dedicated) {
    assertDirect(dedicated, "DATABASE_URL_MIGRATIONS");
    return { url: dedicated, source: "DATABASE_URL_MIGRATIONS" };
  }
  for (const name of ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
    const value = clean(env[name]);
    if (!value) continue;
    assertDirect(value, name);
    return { url: value, source: name };
  }
  const databaseUrl = clean(env.DATABASE_URL);
  if (!databaseUrl) {
    throw new Error(
      "sem URL de migração. Defina DATABASE_URL_MIGRATIONS com a conexão direta do Neon, ou DATABASE_URL se ela já for direta.",
    );
  }
  assertDirect(databaseUrl, "DATABASE_URL");
  return { url: databaseUrl, source: "DATABASE_URL" };
}

// Na Vercel só Production migra. Preview e development saem sem conectar.
// Qualquer outro VERCEL_ENV, ou VERCEL=1 sem VERCEL_ENV, falha o build.
export function migrationAction(env, { baseline }) {
  const vercelEnv = clean(env.VERCEL_ENV);
  const onVercel = env.VERCEL === "1" || vercelEnv !== "";
  if (baseline && onVercel) {
    return { action: "refuse", reason: "baseline não roda no build da Vercel" };
  }
  if (onVercel && vercelEnv !== "production") {
    if (vercelEnv === "preview" || vercelEnv === "development") {
      return { action: "skip", reason: `VERCEL_ENV=${vercelEnv}` };
    }
    return { action: "refuse", reason: vercelEnv ? `VERCEL_ENV=${vercelEnv}` : "VERCEL=1 sem VERCEL_ENV" };
  }
  return { action: baseline ? "baseline" : "apply", reason: "" };
}

export function parseMigrateArgs(argv) {
  let baseline = false;
  let through;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--baseline") {
      baseline = true;
      continue;
    }
    if (arg === "--through") {
      through = argv[++i];
      if (!through || through.startsWith("-")) throw new Error("--through precisa do nome do arquivo");
      if (!MIGRATION_FILENAME.test(through)) throw new Error("--through não é um nome de migração válido");
      continue;
    }
    throw new Error("argumento desconhecido");
  }
  if (through && !baseline) throw new Error("--through só pode ser usado com --baseline");
  return { baseline, through };
}

export async function loadMigrationFiles(dir) {
  const root = path.resolve(dir);
  const entries = await readdir(root, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() && entry.name.endsWith(".sql")) {
      throw new Error(`atalho recusado: ${entry.name}`);
    }
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    if (!MIGRATION_FILENAME.test(entry.name)) {
      throw new Error(`arquivo de migração recusado: ${entry.name}`);
    }
    names.push(entry.name);
  }
  names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const files = [];
  for (const name of names) {
    const full = path.resolve(root, name);
    if (path.dirname(full) !== root) throw new Error(`caminho recusado: ${name}`);
    const bytes = await readFile(full);
    if (bytes.includes(0)) throw new Error(`${name} contém byte nulo`);
    const sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!sql.trim()) throw new Error(`${name} está vazio`);
    assertExecutableSql(name, sql);
    files.push({ name, sql, checksum: checksumOf(bytes) });
  }
  return files;
}

export function assertExecutableSql(name, sql) {
  for (const [pattern, label] of FORBIDDEN_SQL) {
    if (pattern.test(sql)) {
      throw new Error(`${name} contém ${label}; cada arquivo roda numa transação aberta pelo runner`);
    }
  }
}

function isChecksum(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function safeRollback(query) {
  try {
    await query("rollback");
  } catch {
    // a transação pode já ter sido desfeita
  }
}

export async function acquireMigrationLock(query, options = {}) {
  const attempts = options.attempts ?? 30;
  const delayMs = options.delayMs ?? 2000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let i = 0; i < attempts; i++) {
    const { rows } = await query("select pg_try_advisory_lock($1::bigint) as locked", [MIGRATION_LOCK_KEY]);
    if (rows[0]?.locked === true) return;
    if (i < attempts - 1) await sleep(delayMs);
  }
  throw new Error("não consegui o lock de migração; outro deploy está migrando. Este processo não aplicou nada.");
}

export async function releaseMigrationLock(query) {
  const { rows } = await query("select pg_advisory_unlock($1::bigint) as released", [MIGRATION_LOCK_KEY]);
  return rows[0]?.released === true;
}

function sortFiles(files) {
  return [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function assertFiles(files) {
  const seen = new Set();
  for (const file of files) {
    if (!file || typeof file.name !== "string" || !MIGRATION_FILENAME.test(file.name)) {
      throw new Error("nome de migração recusado");
    }
    if (seen.has(file.name)) throw new Error(`migração duplicada: ${file.name}`);
    seen.add(file.name);
    if (!isChecksum(file.checksum)) throw new Error(`checksum inválido em ${file.name}`);
    if (typeof file.sql !== "string" || !file.sql.trim()) throw new Error(`${file.name} está vazio`);
    assertExecutableSql(file.name, file.sql);
  }
  return seen;
}

/**
 * `through` só vale no baseline. O retorno tem `applied` no modo apply e `baselined`/`pending` no baseline.
 * @param {{ query: Function; files: { name: string; sql: string; checksum: string }[]; mode: string; through?: string; log?: (line: string) => void }} options
 * @returns {Promise<{ applied?: string[]; baselined?: string[]; pending?: string[] }>}
 */
export async function runMigrations({ query, files, mode, through, log = () => {} }) {
  if (mode !== "apply" && mode !== "baseline") throw new Error("modo de migração inválido");
  const ordered = sortFiles(files);
  const known = assertFiles(ordered);
  if (through !== undefined && !known.has(through)) {
    throw new Error("--through não corresponde a nenhuma migração carregada");
  }

  await query("begin");
  try {
    await query(CREATE_MIGRATIONS_TABLE);
    await query(ADD_CHECKSUM_COLUMN);
    await query("commit");
  } catch (err) {
    await safeRollback(query);
    throw err;
  }

  const loaded = await query("select name, checksum from schema_migrations");
  if (!Array.isArray(loaded.rows)) throw new Error("resposta inesperada ao ler schema_migrations");
  const applied = new Map();
  for (const row of loaded.rows) {
    if (!row || typeof row.name !== "string" || !MIGRATION_FILENAME.test(row.name)) {
      throw new Error("schema_migrations tem um nome inesperado");
    }
    if (applied.has(row.name)) throw new Error(`schema_migrations duplicado: ${row.name}`);
    applied.set(row.name, row.checksum ?? null);
  }
  for (const name of applied.keys()) {
    if (!known.has(name)) {
      throw new Error(`schema_migrations registra ${name}, ausente em db/migrations. Nada foi aplicado.`);
    }
  }

  const sealed = [];
  await query("begin");
  try {
    for (const file of ordered) {
      if (!applied.has(file.name)) continue;
      const current = applied.get(file.name);
      if (current == null) {
        const updated = await query(
          "update schema_migrations set checksum = $2 where name = $1 and checksum is null returning name",
          [file.name, file.checksum],
        );
        if (updated.rows.length !== 1) {
          throw new Error(`não consegui registrar o checksum de ${file.name}. Nada pendente foi aplicado.`);
        }
        applied.set(file.name, file.checksum);
        sealed.push(file.name);
        continue;
      }
      if (!isChecksum(current) || current !== file.checksum) {
        throw new Error(
          `checksum divergente em ${file.name}; o arquivo mudou depois de aplicado. Nada pendente foi aplicado.`,
        );
      }
    }
    await query("commit");
  } catch (err) {
    await safeRollback(query);
    throw err;
  }
  for (const name of sealed) log(`checksum registrado: ${name}`);

  if (mode === "baseline") return baseline({ query, ordered, applied, through, log });

  for (const file of ordered) {
    if (applied.has(file.name)) continue;
    await query("begin");
    try {
      await query(file.sql);
      await query("insert into schema_migrations (name, checksum) values ($1, $2)", [file.name, file.checksum]);
      await query("commit");
      applied.set(file.name, file.checksum);
      log(`aplicada: ${file.name}`);
    } catch (err) {
      await safeRollback(query);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`falha em ${file.name}: ${message}`);
    }
  }
  log("banco atualizado");
  return { applied: ordered.map((file) => file.name) };
}

async function sentinelPresent(query, sentinel) {
  if (sentinel.kind === "table") {
    if (!IDENT.test(sentinel.name)) throw new Error("sentinela inválida");
    const { rows } = await query(
      `select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = $1
       ) as present`,
      [sentinel.name],
    );
    return rows[0]?.present === true;
  }
  if (sentinel.kind === "column") {
    if (!IDENT.test(sentinel.table) || !IDENT.test(sentinel.name)) throw new Error("sentinela inválida");
    const { rows } = await query(
      `select exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = $2
       ) as present`,
      [sentinel.table, sentinel.name],
    );
    return rows[0]?.present === true;
  }
  throw new Error("sentinela inválida");
}

async function baseline({ query, ordered, applied, through, log }) {
  const pending = ordered.filter((file) => !applied.has(file.name));
  if (pending.length === 0) {
    log("baseline: tudo que está em db/migrations já está registrado");
    return { baselined: [], pending: [] };
  }

  const baselined = [];
  const notes = [];
  await query("begin");
  try {
    for (const file of pending) {
      if (through && file.name > through) break;
      const sentinel = SENTINELS[file.name];
      if (!sentinel) {
        notes.push(`baseline parou antes de ${file.name} (sem verificação de esquema; não marco no escuro)`);
        break;
      }
      const present = await sentinelPresent(query, sentinel);
      if (!present) {
        notes.push(`baseline parou antes de ${file.name} (o esquema dessa migração não está no banco)`);
        break;
      }
      await query("insert into schema_migrations (name, checksum) values ($1, $2)", [file.name, file.checksum]);
      baselined.push(file.name);
      notes.push(`baseline: ${file.name}`);
    }

    if (through && !applied.has(through) && !baselined.includes(through)) {
      throw new Error(
        `baseline recusado: ${through} não foi marcado. Nada foi gravado. Confira se essa migração já está aplicada.`,
      );
    }
    if (baselined.length === 0 && applied.size === 0) {
      throw new Error(
        "baseline recusado: nenhuma migração antiga está aplicada. Num banco vazio use npm run db:migrate, sem baseline.",
      );
    }
    await query("commit");
  } catch (err) {
    await safeRollback(query);
    throw err;
  }

  for (const line of notes) log(line);
  const still = ordered
    .filter((file) => !applied.has(file.name) && !baselined.includes(file.name))
    .map((file) => file.name);
  if (still.length) log(`pendentes, sem executar: ${still.join(", ")}`);
  else log("baseline: nenhuma migração ficou de fora");
  return { baselined, pending: still };
}
