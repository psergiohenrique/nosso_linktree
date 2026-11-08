// Aplica db/migrations pendentes, ou marca como aplicadas as que o esquema já tem (--baseline).
// No build da Vercel só roda com VERCEL_ENV=production. Preview não abre conexão.
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  acquireMigrationLock,
  loadMigrationFiles,
  migrationAction,
  parseMigrateArgs,
  redactSecrets,
  releaseMigrationLock,
  resolveMigrationUrl,
  runMigrations,
} from "./migrations.mjs";

function errorText(err) {
  if (!(err instanceof Error)) return redactSecrets(err);
  const code = "code" in err && typeof err.code === "string" && /^[0-9A-Z]{5}$/.test(err.code) ? ` (${err.code})` : "";
  return redactSecrets(`${err.message}${code}`);
}

async function main() {
  const args = parseMigrateArgs(process.argv.slice(2));
  const action = migrationAction(process.env, { baseline: args.baseline });
  if (action.action === "skip") {
    console.log(`migrações: ignoradas (${action.reason}). Este ambiente não conecta no banco.`);
    return;
  }
  if (action.action === "refuse") {
    throw new Error(`migrações recusadas (${action.reason})`);
  }

  const { url, source } = resolveMigrationUrl(process.env);
  console.log(`migrações: usando ${source}`);
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 300_000,
    query_timeout: 300_000,
    application_name: "linkbio-migrate",
  });
  client.on("error", (err) => {
    console.error(`migrações: erro de conexão (${errorText(err)})`);
  });

  let locked = false;
  const query = (sql, params) => (params === undefined ? client.query(sql) : client.query(sql, params));
  try {
    await client.connect();
    await query("select set_config('lock_timeout', '30s', false)");
    await query("select set_config('idle_in_transaction_session_timeout', '120s', false)");
    await acquireMigrationLock(query);
    locked = true;
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
    const files = await loadMigrationFiles(dir);
    await runMigrations({
      query,
      files,
      mode: action.action === "baseline" ? "baseline" : "apply",
      through: args.through,
      log: (line) => console.log(line),
    });
  } finally {
    if (locked) {
      try {
        const released = await releaseMigrationLock(query);
        if (!released) console.error("migrações: o lock não estava preso nesta sessão");
      } catch (err) {
        console.error(`migrações: falha ao soltar o lock (${errorText(err)})`);
      }
    }
    try {
      await client.end();
    } catch (err) {
      console.error(`migrações: falha ao fechar a conexão (${errorText(err)})`);
    }
  }
}

main().catch((err) => {
  console.error(errorText(err));
  process.exitCode = 1;
});
