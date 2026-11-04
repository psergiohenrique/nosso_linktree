import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn(), sendMail: vi.fn() }));
vi.mock("@/server/db", () => ({ query: mocks.query, queryOne: mocks.queryOne }));
vi.mock("@/server/mail", () => ({ sendMail: mocks.sendMail }));

import { GET } from "@/app/api/cron/forms/route";
import { notifyOwner, type PublicForm } from "@/server/forms";

const originalSecret = process.env.CRON_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  vi.clearAllMocks();
});

describe("privacidade dos formulários", () => {
  it("notifica sem incluir respostas, com link ao painel", async () => {
    const form = { title: "Contato <teste>", name: "Contato", owner_email: "dono@example.test" } as PublicForm;
    await notifyOwner(form, "response-id");
    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.to).toBe(form.owner_email);
    expect(mail.text).toContain("/dashboard/formularios/response-id");
    expect(mail.html).toContain("Contato &lt;teste&gt;");
    expect(mail.html).toContain("/dashboard/formularios/response-id");
    expect(mail.text).not.toContain("resposta sensível");
    expect(mail.html).not.toContain("resposta sensível");
  });

  it("exige segredo configurado e bearer correto antes da limpeza", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(new NextRequest("https://example.test/api/cron/forms"))).status).toBe(401);
    process.env.CRON_SECRET = "secret";
    expect((await GET(new NextRequest("https://example.test/api/cron/forms", { headers: { authorization: "Bearer errado" } }))).status).toBe(401);
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it("limpa somente parciais antigas com o prazo existente", async () => {
    process.env.CRON_SECRET = "secret";
    mocks.queryOne.mockResolvedValueOnce({ deleted: "2" });
    const response = await GET(new NextRequest("https://example.test/api/cron/forms", { headers: { authorization: "Bearer secret" } }));
    expect(await response.json()).toEqual({ deleted: 2 });
    const [sql, params] = mocks.queryOne.mock.calls[0];
    expect(sql).toMatch(/status = 'partial' and updated_at < now\(\) - make_interval\(days => \$1\)/);
    expect(params).toEqual([180]);
  });
});
