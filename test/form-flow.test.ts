import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFields } from "@/lib/form-fields";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("notFound"); }), redirect: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/forms", () => ({
  formsEnabled: vi.fn(), getOwnedForm: vi.fn(), updateBuilderForm: vi.fn(), createBuilderForm: vi.fn(),
  getPublicForm: vi.fn(), submitPublicResponse: vi.fn(),
}));
vi.mock("@/server/profiles", () => ({ getProfileByUser: vi.fn(), getLinksByProfile: vi.fn().mockResolvedValue([]) }));
vi.mock("@/server/rate-limit", () => ({ clientIp: vi.fn() }));

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { formsEnabled, getOwnedForm, updateBuilderForm, getPublicForm, submitPublicResponse } from "@/server/forms";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { clientIp } from "@/server/rate-limit";
import { saveForm } from "@/app/dashboard/formularios/actions";
import { POST } from "@/app/api/forms/publico/route";
import type { NextRequest } from "next/server";

const id = "12345678-1234-1234-1234-123456789abc";
const fields = defaultFields();

function editorData() {
  const data = new FormData();
  data.set("name", " Orçamento ");
  data.set("title", " Contato ");
  data.set("slug", " Novo Endereço ");
  data.set("fields", JSON.stringify(fields));
  data.set("isPublished", "on");
  return data;
}

function request(body: string) {
  return new Request("http://localhost/api/forms/publico", { method: "POST", body }) as NextRequest;
}

describe("salvar formulário no painel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ id: "owner" } as Awaited<ReturnType<typeof requireUser>>);
    vi.mocked(formsEnabled).mockResolvedValue(true);
    vi.mocked(getOwnedForm).mockResolvedValue({ id, slug: "antigo", fields } as Awaited<ReturnType<typeof getOwnedForm>>);
    vi.mocked(updateBuilderForm).mockResolvedValue("ok");
    vi.mocked(getProfileByUser).mockResolvedValue({ slug: "perfil" } as Awaited<ReturnType<typeof getProfileByUser>>);
    vi.mocked(getLinksByProfile).mockResolvedValue([]);
  });

  it("valida perguntas no servidor antes de persistir", async () => {
    const data = editorData();
    data.set("fields", JSON.stringify([{ type: "radio", label: "Escolha", options: [] }]));
    expect(await saveForm(id, {}, data)).toEqual({ error: "Pergunta 1: adicione as opções." });
    expect(updateBuilderForm).not.toHaveBeenCalled();
    data.set("fields", "{");
    expect(await saveForm(id, {}, data)).toEqual({ error: "Perguntas inválidas." });
  });

  it("nega conta sem acesso e formulário de outro proprietário ou externo", async () => {
    vi.mocked(formsEnabled).mockResolvedValueOnce(false);
    await expect(saveForm(id, {}, editorData())).rejects.toThrow("notFound");
    vi.mocked(getOwnedForm).mockResolvedValueOnce(null).mockResolvedValueOnce({ id, fields: null } as Awaited<ReturnType<typeof getOwnedForm>>);
    await expect(saveForm(id, {}, editorData())).rejects.toThrow("notFound");
    await expect(saveForm(id, {}, editorData())).rejects.toThrow("notFound");
    expect(updateBuilderForm).not.toHaveBeenCalled();
  });

  it("normaliza endereço, publica e invalida as URLs antiga e nova", async () => {
    expect(await saveForm(id, {}, editorData())).toEqual({ saved: true });
    expect(updateBuilderForm).toHaveBeenCalledWith("owner", id, expect.objectContaining({
      name: "Orçamento", title: "Contato", slug: "novo-endereco", isPublished: true, notifyEmail: false,
    }));
    expect(revalidatePath).toHaveBeenCalledWith("/perfil/f/antigo");
    expect(revalidatePath).toHaveBeenCalledWith("/perfil/f/novo-endereco");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/formularios");
  });

  it("exibe conflito de endereço sem invalidar páginas", async () => {
    vi.mocked(updateBuilderForm).mockResolvedValue("slug_taken");
    expect(await saveForm(id, {}, editorData())).toEqual({ error: "Esse endereço já está em uso por outro formulário." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("API pública de respostas", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejeita corpo grande em bytes antes de consultar o formulário", async () => {
    const response = await POST(request("á".repeat(65537)));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, error: "too_large" });
    expect(getPublicForm).not.toHaveBeenCalled();
  });

  it("não consulta UUID inválido e não aceita formulário indisponível", async () => {
    expect((await POST(request("{"))).status).toBe(404);
    expect((await POST(request(JSON.stringify({ formId: "inválido" })))).status).toBe(404);
    expect(getPublicForm).not.toHaveBeenCalled();
    vi.mocked(getPublicForm).mockResolvedValue(null);
    expect((await POST(request(JSON.stringify({ formId: id })))).status).toBe(404);
    expect(submitPublicResponse).not.toHaveBeenCalled();
  });

  it("encaminha validação por campo e responde sucesso sem expor id interno", async () => {
    const form = { id, fields } as NonNullable<Awaited<ReturnType<typeof getPublicForm>>>;
    vi.mocked(getPublicForm).mockResolvedValue(form);
    vi.mocked(clientIp).mockResolvedValue("127.0.0.1");
    vi.mocked(submitPublicResponse).mockResolvedValueOnce({ ok: false, status: 422, error: "inválido", fieldId: fields[0].id });
    const body = { formId: id, status: "complete", answers: {} };
    const invalid = await POST(request(JSON.stringify(body)));
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toEqual({ ok: false, error: "inválido", fieldId: fields[0].id });
    expect(submitPublicResponse).toHaveBeenCalledWith(form, body, "127.0.0.1");
    vi.mocked(submitPublicResponse).mockResolvedValueOnce({ ok: true, id: "interno" });
    const success = await POST(request(JSON.stringify(body)));
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ ok: true });
  });
});
