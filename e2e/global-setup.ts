import { execFileSync } from "node:child_process";
import { E2E_DATABASE_URL } from "../playwright.config";

/** Aplica as migrações e recria a conta de demonstração (barbearia-demo) no banco local. */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DATABASE_URL_MIGRATIONS: E2E_DATABASE_URL };
  execFileSync("node", ["scripts/migrate.mjs"], { env, stdio: "inherit" });
  execFileSync("node", ["scripts/seed.mjs"], { env, stdio: "inherit" });
}
