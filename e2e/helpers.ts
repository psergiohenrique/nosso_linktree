import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_DATABASE_URL } from "../playwright.config";

export const DEMO = { email: "demo@linkbio.test", password: "demo-linkbio-2026", slug: "barbearia-demo" };

export async function db<T>(fn: (client: pg.Client) => Promise<T>) {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(DEMO.email);
  await page.locator("#password").fill(DEMO.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
