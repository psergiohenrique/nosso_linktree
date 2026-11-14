import { expect, test } from "@playwright/test";
import { DEMO, db, login } from "./helpers";

test("cadastro leva à confirmação do e-mail", async ({ page }) => {
  const email = `e2e-${Date.now()}@linkbio.test`;
  await page.goto("/login?modo=cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Ana");
  await page.getByLabel("Sobrenome").fill("Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.locator("#password").fill("senha-forte-123");
  await page.locator("#confirm").fill("senha-forte-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/login\/confirmar/);
  await db((c) => c.query("delete from users where email = $1", [email]));
});

test("login errado mostra erro e não entra", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(DEMO.email);
  await page.locator("#password").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/dashboard/);
});

test("painel exige sessão", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("edição no painel aparece na página pública", async ({ page }) => {
  const title = `Link e2e ${Date.now()}`;
  await login(page);
  await page.locator("[data-new-link]").first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Título").fill(title);
  await sheet.getByLabel("Link", { exact: true }).fill("https://example.com/e2e");
  await sheet.getByRole("button", { name: "Adicionar link" }).click();
  await expect(page.getByText(title).first()).toBeVisible();

  // A página pública usa cache de até 60 s, mas a ação do painel a revalida na hora.
  await page.goto(`/${DEMO.slug}`);
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await db((c) => c.query("delete from links where title = $1", [title]));
});

test("clique na página pública é rastreado e redireciona", async ({ page, request }) => {
  await page.goto(`/${DEMO.slug}`);
  await expect(page.getByRole("heading", { name: "Barbearia do Zé" })).toBeVisible();
  const href = await page.getByRole("link", { name: "Ver tabela de preços" }).getAttribute("href");
  expect(href).toMatch(/^\/go\//);

  const count = () =>
    db(async (c) => Number((await c.query("select count(*) n from events where type = 'click'")).rows[0].n));
  const before = await count();
  const res = await request.get(href!, { maxRedirects: 0, headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" } });
  expect(res.status()).toBe(302);
  expect(res.headers().location).toBe("https://example.com/precos");
  expect(await count()).toBe(before + 1);
});

test("com a cobrança desligada, a aba Plano não aparece", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("link", { name: "Aparência" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Plano", exact: true })).toHaveCount(0);
});
