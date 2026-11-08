import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireMigrationLock,
  checksumOf,
  loadMigrationFiles,
  MIGRATION_LOCK_KEY,
  migrationAction,
  parseMigrateArgs,
  redactSecrets,
  resolveMigrationUrl,
  runMigrations,
  SENTINELS,
} from "../scripts/migrations.mjs";

const DIRECT = "postgresql://linkbio:segredo@ep-plain.us-east-2.aws.neon.tech/linkbio?sslmode=require";
const POOLED = "postgresql://linkbio:segredo@ep-plain-pooler.us-east-2.aws.neon.tech/linkbio?sslmode=require";

const file = (name: string, sql = `create table ${name.slice(0, 4)} (id int);`) => ({
  name,
  sql,
  checksum: checksumOf(Buffer.from(sql)),
});

type Row = { name: string; checksum: string | null };

function createFake(options?: { present?: { tables?: string[]; columns?: string[] }; seed?: Row[] }) {
  const present = {
    tables: new Set(options?.present?.tables ?? []),
    columns: new Set(options?.present?.columns ?? []),
  };
  let applied = new Map<string, string | null>((options?.seed ?? []).map((row) => [row.name, row.checksum]));
  let snapshot: Map<string, string | null> | null = null;
  const executed: string[] = [];
  const calls: { sql: string; params?: unknown[] }[] = [];

  const query = async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    const compact = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (compact === "begin") {
      if (snapshot) throw new Error("transação aninhada");
      snapshot = new Map(applied);
      return { rows: [] };
    }
    if (compact === "commit") {
      snapshot = null;
      return { rows: [] };
    }
    if (compact === "rollback") {
      if (snapshot) applied = snapshot;
      snapshot = null;
      return { rows: [] };
    }
    if (compact.startsWith("create table if not exists schema_migrations")) return { rows: [] };
    if (compact.startsWith("alter table schema_migrations")) return { rows: [] };
    if (compact.startsWith("select name, checksum from schema_migrations")) {
      return { rows: [...applied].map(([name, checksum]) => ({ name, checksum })) };
    }
    if (compact.startsWith("update schema_migrations")) {
      const [name, checksum] = params as [string, string];
      if (applied.has(name) && applied.get(name) == null) {
        applied.set(name, checksum);
        return { rows: [{ name }] };
      }
      return { rows: [] };
    }
    if (compact.startsWith("insert into schema_migrations")) {
      const [name, checksum] = params as [string, string];
      if (applied.has(name)) throw new Error("duplicate key");
      applied.set(name, checksum);
      return { rows: [] };
    }
    if (compact.includes("from information_schema.tables")) {
      return { rows: [{ present: present.tables.has(String(params?.[0])) }] };
    }
    if (compact.includes("from information_schema.columns")) {
      return { rows: [{ present: present.columns.has(`${params?.[0]}.${params?.[1]}`) }] };
    }
    if (sql.includes("boom")) throw new Error("sintaxe inválida");
    executed.push(sql);
    return { rows: [] };
  };

  return { query, executed, calls, applied: () => applied };
}

describe("resolveMigrationUrl", () => {
  it("prefere DATABASE_URL_MIGRATIONS e não usa a URL pooled", () => {
    const resolved = resolveMigrationUrl({ DATABASE_URL_MIGRATIONS: DIRECT, DATABASE_URL: POOLED });
    expect(resolved).toEqual({ url: DIRECT, source: "DATABASE_URL_MIGRATIONS" });
  });

  it("recusa pooler mesmo na variável dedicada", () => {
    expect(() => resolveMigrationUrl({ DATABASE_URL_MIGRATIONS: POOLED, DATABASE_URL: DIRECT })).toThrow(/pooler/);
  });

  it("cai na URL direta conhecida antes de DATABASE_URL", () => {
    const unpooled = "postgresql://linkbio:segredo@ep-plain.us-east-2.aws.neon.tech/linkbio";
    expect(resolveMigrationUrl({ DATABASE_URL: POOLED, POSTGRES_URL_NON_POOLING: unpooled }).source).toBe(
      "POSTGRES_URL_NON_POOLING",
    );
    expect(resolveMigrationUrl({ DATABASE_URL: DIRECT, DATABASE_URL_UNPOOLED: unpooled }).source).toBe(
      "DATABASE_URL_UNPOOLED",
    );
  });

  it("recusa DATABASE_URL de pooler, porta 6543 e pgbouncer", () => {
    expect(() => resolveMigrationUrl({ DATABASE_URL: POOLED })).toThrow(/pooler/);
    expect(() => resolveMigrationUrl({ DATABASE_URL: "postgresql://u:p@db.example.com:6543/linkbio" })).toThrow(/pooler/);
    expect(() => resolveMigrationUrl({ DATABASE_URL: "postgresql://u:p@db.example.com/linkbio?pgbouncer=true" })).toThrow(
      /pooler/,
    );
  });

  it("aceita o Postgres local, que não é pooler", () => {
    const local = "postgresql://linkbio:linkbio@localhost:5435/linkbio";
    expect(resolveMigrationUrl({ DATABASE_URL: local })).toEqual({ url: local, source: "DATABASE_URL" });
  });

  it("não ecoa a URL quando ela é inválida", () => {
    expect(() => resolveMigrationUrl({ DATABASE_URL: "http://nao-e-postgres" })).toThrow(/não é uma URL postgresql válida/);
    try {
      resolveMigrationUrl({ DATABASE_URL_MIGRATIONS: "não é url postgresql://user:supersegredo@host/db" });
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain("supersegredo");
    }
  });
});

describe("redactSecrets", () => {
  it("remove a connection string e senhas soltas", () => {
    const leaked = `falha em postgresql://linkbio:supersegredo@ep-plain.neon.tech/linkbio password=supersegredo`;
    const redacted = redactSecrets(leaked);
    expect(redacted).not.toContain("supersegredo");
    expect(redacted).toContain("postgresql://[redacted]");
    expect(redacted).toContain("password=[redacted]");
  });
});

describe("migrationAction", () => {
  it("só aplica em produção e pula preview sem conectar", () => {
    expect(migrationAction({ VERCEL: "1", VERCEL_ENV: "production" }, { baseline: false }).action).toBe("apply");
    expect(migrationAction({ VERCEL: "1", VERCEL_ENV: "preview" }, { baseline: false }).action).toBe("skip");
    expect(migrationAction({ VERCEL_ENV: "development" }, { baseline: false }).action).toBe("skip");
    expect(migrationAction({}, { baseline: false }).action).toBe("apply");
  });

  it("falha fechado fora de production/preview/development e recusa baseline na Vercel", () => {
    expect(migrationAction({ VERCEL: "1" }, { baseline: false }).action).toBe("refuse");
    expect(migrationAction({ VERCEL: "1", VERCEL_ENV: "staging" }, { baseline: false }).action).toBe("refuse");
    expect(migrationAction({ VERCEL: "1", VERCEL_ENV: "production" }, { baseline: true }).action).toBe("refuse");
    expect(migrationAction({ VERCEL_ENV: "preview" }, { baseline: true }).action).toBe("refuse");
    expect(migrationAction({}, { baseline: true }).action).toBe("baseline");
  });
});

describe("parseMigrateArgs", () => {
  it("não repete o argumento desconhecido na mensagem", () => {
    expect(() => parseMigrateArgs(["postgresql://user:segredo@host/db"])).toThrow(/^argumento desconhecido$/);
    expect(parseMigrateArgs(["--baseline", "--through", "0013_show_avatar.sql"])).toEqual({
      baseline: true,
      through: "0013_show_avatar.sql",
    });
    expect(() => parseMigrateArgs(["--through", "0013_show_avatar.sql"])).toThrow(/--baseline/);
  });
});

describe("loadMigrationFiles", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("ordena pelo nome e recusa arquivo fora do padrão", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lb-mig-"));
    dirs.push(dir);
    await writeFile(path.join(dir, "0010_later.sql"), "select 10;");
    await writeFile(path.join(dir, "0002_second.sql"), "select 2;");
    await writeFile(path.join(dir, "0001_first.sql"), "select 1;");
    await writeFile(path.join(dir, "notas.txt"), "ignorar");
    const files = await loadMigrationFiles(dir);
    expect(files.map((item) => item.name)).toEqual(["0001_first.sql", "0002_second.sql", "0010_later.sql"]);
    expect(files[0].checksum).toBe(checksumOf(Buffer.from("select 1;")));

    await writeFile(path.join(dir, "0003_Bad.sql"), "select 3;");
    await expect(loadMigrationFiles(dir)).rejects.toThrow(/recusado: 0003_Bad.sql/);
  });

  it("recusa atalho e controle de transação", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lb-mig-"));
    const outside = await mkdtemp(path.join(tmpdir(), "lb-mig-out-"));
    dirs.push(dir, outside);
    await writeFile(path.join(outside, "fora.sql"), "select 1;");
    await symlink(path.join(outside, "fora.sql"), path.join(dir, "0001_link.sql"));
    await expect(loadMigrationFiles(dir)).rejects.toThrow(/atalho/);

    const tx = await mkdtemp(path.join(tmpdir(), "lb-mig-tx-"));
    dirs.push(tx);
    await writeFile(path.join(tx, "0001_tx.sql"), "begin;\nselect 1;\ncommit;");
    await expect(loadMigrationFiles(tx)).rejects.toThrow(/BEGIN/);
  });

  it("carrega as migrações reais do repositório", async () => {
    const dir = path.resolve(import.meta.dirname, "../db/migrations");
    const files = await loadMigrationFiles(dir);
    expect(files.map((item) => item.name)).toEqual([...(await readdir(dir))].filter((name) => name.endsWith(".sql")).sort());
    for (const item of files) {
      expect(item.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(SENTINELS[item.name as keyof typeof SENTINELS]).toBeTruthy();
    }
  });
});

describe("runMigrations", () => {
  const first = file("0001_first.sql", "select 1;");
  const second = file("0002_second.sql", "select 2;");
  const tenth = file("0010_tenth.sql", "select 10;");

  it("aplica em ordem de nome, com o nome só em parâmetro", async () => {
    const db = createFake();
    await runMigrations({ query: db.query, files: [tenth, first, second], mode: "apply" });
    expect(db.executed).toEqual(["select 1;", "select 2;", "select 10;"]);
    const inserts = db.calls.filter((call) => call.sql.includes("insert into schema_migrations"));
    expect(inserts.map((call) => call.params?.[0])).toEqual([first.name, second.name, tenth.name]);
    for (const call of inserts) expect(call.sql).not.toContain(String(call.params?.[0]));
  });

  it("é idempotente: a segunda execução não roda SQL de novo", async () => {
    const db = createFake();
    await runMigrations({ query: db.query, files: [second, first], mode: "apply" });
    const afterFirst = db.executed.length;
    await runMigrations({ query: db.query, files: [first, second], mode: "apply" });
    expect(db.executed).toHaveLength(afterFirst);
    expect([...db.applied().keys()]).toEqual([first.name, second.name]);
  });

  it("checksum divergente não aplica o que vem depois e desfaz o preenchimento legado", async () => {
    const stale = "ab".repeat(32);
    const legacy = file("0001_legacy.sql", "select 1;");
    const changed = file("0002_changed.sql", "select 2;");
    const pending = file("0003_pending.sql", "select 3;");
    const db = createFake({
      seed: [
        { name: legacy.name, checksum: null },
        { name: changed.name, checksum: stale },
      ],
    });
    await expect(
      runMigrations({ query: db.query, files: [pending, changed, legacy], mode: "apply" }),
    ).rejects.toThrow(/checksum divergente em 0002_changed.sql/);
    expect(db.executed).toEqual([]);
    expect(db.applied().get(legacy.name)).toBeNull();
    expect(db.applied().has(pending.name)).toBe(false);
  });

  it("grava o checksum que faltava sem reexecutar o arquivo", async () => {
    const legacy = file("0001_legacy.sql", "select 1;");
    const db = createFake({ seed: [{ name: legacy.name, checksum: null }] });
    await runMigrations({ query: db.query, files: [legacy], mode: "apply" });
    expect(db.executed).toEqual([]);
    expect(db.applied().get(legacy.name)).toBe(legacy.checksum);
  });

  it("falha no meio não grava a migração nem segue para a próxima", async () => {
    const ok = file("0001_ok.sql", "select 1;");
    const bad = file("0002_bad.sql", "boom");
    const later = file("0003_later.sql", "select 3;");
    const db = createFake();
    await expect(runMigrations({ query: db.query, files: [later, bad, ok], mode: "apply" })).rejects.toThrow(
      /falha em 0002_bad.sql/,
    );
    expect(db.executed).toEqual(["select 1;"]);
    expect([...db.applied().keys()]).toEqual([ok.name]);
  });

  it("baseline marca só o prefixo cujo esquema existe e não executa SQL", async () => {
    const init = file("0001_init.sql", "create table should_not_run (id int);");
    const layout = file("0002_link_layout_size.sql", "alter table links add column layout text;");
    const auth = file("0003_auth_security.sql", "create table auth_attempts (id int);");
    const db = createFake({ present: { tables: ["users"], columns: ["links.layout"] } });
    const logs: string[] = [];
    const result = await runMigrations({
      query: db.query,
      files: [auth, init, layout],
      mode: "baseline",
      log: (line) => logs.push(line),
    });
    expect(db.executed).toEqual([]);
    expect(result.baselined).toEqual([init.name, layout.name]);
    expect(result.pending).toEqual([auth.name]);
    expect(db.applied().has(auth.name)).toBe(false);
    expect(logs.some((line) => line.includes("parou antes de 0003_auth_security.sql"))).toBe(true);
  });

  it("baseline em banco vazio não grava nada", async () => {
    const init = file("0001_init.sql", "create table users (id int);");
    const db = createFake();
    await expect(runMigrations({ query: db.query, files: [init], mode: "baseline" })).rejects.toThrow(/banco vazio/);
    expect(db.applied().size).toBe(0);
    expect(db.executed).toEqual([]);
  });

  it("--through desfaz tudo se a migração pedida não está aplicada", async () => {
    const init = file("0001_init.sql", "select 1;");
    const avatar = file("0013_show_avatar.sql", "select 13;");
    const db = createFake({ present: { tables: ["users"] } });
    await expect(
      runMigrations({ query: db.query, files: [init, avatar], mode: "baseline", through: avatar.name }),
    ).rejects.toThrow(/0013_show_avatar.sql não foi marcado/);
    expect(db.applied().size).toBe(0);
  });

  it("arquivo já registrado e sumido do disco impede aplicar o resto", async () => {
    const kept = file("0002_kept.sql", "select 2;");
    const db = createFake({ seed: [{ name: "0001_gone.sql", checksum: "ab".repeat(32) }] });
    await expect(runMigrations({ query: db.query, files: [kept], mode: "apply" })).rejects.toThrow(/0001_gone.sql/);
    expect(db.executed).toEqual([]);
  });
});

const repoRoot = path.resolve(import.meta.dirname, "..");

function runCli(extra: NodeJS.ProcessEnv, args: string[] = []) {
  const env = { ...process.env, ...extra };
  return spawnSync(process.execPath, [path.join(repoRoot, "scripts/migrate.mjs"), ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

describe("CLI", () => {
  it("preview não conecta e não imprime a URL", () => {
    const secret = "postgresql://user:supersegredo@127.0.0.1:1/linkbio";
    const result = runCli({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DATABASE_URL: secret,
      DATABASE_URL_MIGRATIONS: secret,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("VERCEL_ENV=preview");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("supersegredo");
  });

  it("produção sem URL direta falha sem revelar segredo", () => {
    const secret = "postgresql://user:supersegredo@ep-plain-pooler.neon.tech/linkbio";
    const result = runCli({
      VERCEL: "1",
      VERCEL_ENV: "production",
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      POSTGRES_URL_NON_POOLING: "",
      DATABASE_URL_MIGRATIONS: secret,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/pooler/);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("supersegredo");
  });

  it("recusa baseline no build", () => {
    const result = runCli({ VERCEL: "1", VERCEL_ENV: "production" }, ["--baseline"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/baseline/);
  });
});

describe("acquireMigrationLock", () => {
  it("espera e desiste sem interpolar a chave no SQL", async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const query = async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [{ locked: false }] };
    };
    await expect(acquireMigrationLock(query, { attempts: 2, delayMs: 0, sleep: async () => {} })).rejects.toThrow(/lock/);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).not.toContain(MIGRATION_LOCK_KEY);
    expect(calls[0].params).toEqual([MIGRATION_LOCK_KEY]);
  });
});
