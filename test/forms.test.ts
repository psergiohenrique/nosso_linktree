import { describe, expect, it } from "vitest";
import { parseResponsePayload, progressLabel } from "@/lib/forms";
import { formKey, parseFormKey } from "@/server/forms";

const ID = "3f2b8c1e-7a4d-4e9b-9c1a-2b3c4d5e6f70";

describe("parseResponsePayload", () => {
  const base = {
    responseId: "A1B2C3D4-0000-4000-8000-000000000001",
    status: "partial",
    step: 2,
    totalSteps: 13,
    answers: [
      { id: "nome", label: "Qual o seu nome?", value: "  Maria  " },
      { id: "whatsapp", label: "Qual o seu WhatsApp?", value: "(44) 99999-1234" },
      { id: "instagram", label: "Qual o seu Instagram?", value: "" },
    ],
    pageUrl: "https://www.leticiamoraes.arq.br/#contato",
  };

  it("normaliza, descarta respostas vazias e extrai nome e telefone", () => {
    const p = parseResponsePayload(base)!;
    expect(p.clientId).toBe("a1b2c3d4-0000-4000-8000-000000000001");
    expect(p.answers).toEqual([
      { id: "nome", label: "Qual o seu nome?", value: "Maria" },
      { id: "whatsapp", label: "Qual o seu WhatsApp?", value: "(44) 99999-1234" },
    ]);
    expect(p.contactName).toBe("Maria");
    expect(p.contactPhone).toBe("(44) 99999-1234");
    expect(p.step).toBe(2);
    expect(p.totalSteps).toBe(13);
  });

  it("contact explícito tem prioridade sobre as perguntas", () => {
    const p = parseResponsePayload({ ...base, contact: { name: "Mari", phone: "4488887777" } })!;
    expect(p.contactName).toBe("Mari");
    expect(p.contactPhone).toBe("4488887777");
  });

  it("corta textos longos em vez de recusar", () => {
    const p = parseResponsePayload({ ...base, answers: [{ id: "msg", label: "x", value: "a".repeat(5000) }] })!;
    expect(p.answers[0].value).toHaveLength(4000);
  });

  it("recusa id inválido, status desconhecido, ids repetidos e excesso de perguntas", () => {
    expect(parseResponsePayload({ ...base, responseId: "123" })).toBeNull();
    expect(parseResponsePayload({ ...base, status: "done" })).toBeNull();
    expect(parseResponsePayload({ ...base, answers: [base.answers[0], base.answers[0]] })).toBeNull();
    const many = Array.from({ length: 51 }, (_, i) => ({ id: `q${i}`, label: "q", value: "v" }));
    expect(parseResponsePayload({ ...base, answers: many })).toBeNull();
    expect(parseResponsePayload(null)).toBeNull();
  });

  it("ignora page_url que não é http(s)", () => {
    expect(parseResponsePayload({ ...base, pageUrl: "javascript:alert(1)" })!.pageUrl).toBeNull();
  });

  it("etapa não passa do total", () => {
    expect(parseResponsePayload({ ...base, step: 20 })!.step).toBe(13);
  });
});

describe("chave do formulário", () => {
  it("é estável, muda com a versão e volta ao id", () => {
    const k1 = formKey({ id: ID, key_version: 1 });
    expect(k1).toMatch(/^lbf_[0-9a-f]{32}_[A-Za-z0-9_-]{32}$/);
    expect(formKey({ id: ID, key_version: 1 })).toBe(k1);
    expect(formKey({ id: ID, key_version: 2 })).not.toBe(k1);
    expect(parseFormKey(k1)?.id).toBe(ID);
    expect(parseFormKey("lbf_xyz")).toBeNull();
  });
});

describe("progressLabel", () => {
  it("mostra etapa de total", () => {
    expect(progressLabel(4, 13)).toBe("4 de 13");
    expect(progressLabel(1, 0)).toBe("1 respondida");
  });
});
