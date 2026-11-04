import { describe, expect, it } from "vitest";
import {
  blankField,
  checkAnswers,
  defaultFields,
  parseFields,
  storedFields,
  validateFormSlug,
  type FormField,
} from "@/lib/form-fields";

const field = (over: Partial<FormField>): FormField => ({ ...blankField(over.type ?? "text"), ...over });

describe("validateFormSlug", () => {
  it("transforma o nome em endereço", () => {
    expect(validateFormSlug("  Orçamento de Projeto! ")).toBe("orcamento-de-projeto");
    expect(validateFormSlug("a")).toBeNull();
    expect(validateFormSlug("!!!")).toBeNull();
    expect(validateFormSlug("x".repeat(60))).toHaveLength(40);
  });
});

describe("parseFields", () => {
  it("normaliza perguntas, opções e ids", () => {
    const out = parseFields([
      { id: "nome", type: "text", label: "  Nome  ", required: true },
      { id: "nome", type: "radio", label: "Tipo", options: ["Casa", " ", "Casa", "Apto", "Outro"], allowOther: true },
      { type: "textarea", label: "Mensagem", required: false, options: ["x"], allowOther: true },
    ]);
    expect("fields" in out).toBe(true);
    if (!("fields" in out)) return;
    const [a, b, c] = out.fields;
    expect(a).toMatchObject({ id: "nome", label: "Nome", required: true });
    expect(b.id).not.toBe("nome");
    expect(b.options).toEqual(["Casa", "Apto"]);
    expect(b.allowOther).toBe(true);
    expect(c).toMatchObject({ required: false, options: [], allowOther: false });
  });

  it("recusa vazio, sem pergunta, sem opções e excesso", () => {
    expect(parseFields([])).toEqual({ error: "Adicione pelo menos uma pergunta." });
    expect(parseFields([{ type: "text", label: " " }])).toEqual({ error: "Pergunta 1: escreva a pergunta." });
    expect(parseFields([{ type: "radio", label: "Tipo", options: [] }])).toEqual({
      error: "Pergunta 1: adicione as opções.",
    });
    expect(parseFields([{ type: "nope", label: "x" }])).toEqual({ error: "Pergunta 1: tipo inválido." });
    expect("error" in parseFields(Array.from({ length: 31 }, () => ({ type: "text", label: "x" })))).toBe(true);
  });

  it("formulário externo (fields null) continua null", () => {
    expect(storedFields(null)).toBeNull();
    expect(storedFields(defaultFields())).toHaveLength(3);
  });
});

describe("checkAnswers", () => {
  const fields = [
    field({ id: "nome", type: "text", label: "Nome" }),
    field({ id: "zap", type: "tel", label: "WhatsApp" }),
    field({ id: "tipo", type: "radio", label: "Tipo", options: ["Casa", "Apto"] }),
    field({ id: "amb", type: "checkbox", label: "Ambientes", options: ["Sala, cozinha", "Quarto"], required: false }),
    field({ id: "email", type: "email", label: "E-mail", required: false }),
  ];

  it("parcial só confere até a etapa e extrai contato", () => {
    const out = checkAnswers(fields, { nome: " Ana ", zap: "44999991234" }, { complete: false, step: 2 });
    expect(out).toMatchObject({ ok: true, contactName: "Ana", contactPhone: "44999991234" });
    if (out.ok) expect(out.answers.map((a) => a.value)).toEqual(["Ana", "44999991234"]);
  });

  it("completa exige as obrigatórias e valida tipos", () => {
    expect(checkAnswers(fields, { nome: "Ana", zap: "44999991234" }, { complete: true, step: 0 })).toMatchObject({
      ok: false,
      fieldId: "tipo",
    });
    expect(checkAnswers(fields, { nome: "Ana", zap: "123" }, { complete: false, step: 2 })).toMatchObject({
      ok: false,
      fieldId: "zap",
    });
    const base = { nome: "Ana", zap: "44999991234", tipo: "Casa" };
    expect(checkAnswers(fields, { ...base, tipo: "Castelo" }, { complete: true, step: 0 })).toMatchObject({
      ok: false,
      fieldId: "tipo",
    });
    expect(checkAnswers(fields, { ...base, email: "x@" }, { complete: true, step: 0 })).toMatchObject({
      ok: false,
      fieldId: "email",
    });
  });

  it("várias opções: aceita opção com vírgula, recusa fora da lista e junta o texto", () => {
    const base = { nome: "Ana", zap: "44999991234", tipo: "Casa" };
    const ok = checkAnswers(fields, { ...base, amb: ["Sala, cozinha", "Quarto"] }, { complete: true, step: 0 });
    expect(ok.ok && ok.answers.find((a) => a.id === "amb")?.value).toBe("Sala, cozinha, Quarto");
    expect(checkAnswers(fields, { ...base, amb: ["Garagem"] }, { complete: true, step: 0 })).toMatchObject({
      ok: false,
      fieldId: "amb",
    });
  });

  it("radio com Outro aceita texto livre", () => {
    const f = [field({ id: "c", type: "radio", label: "Como?", options: ["Instagram"], allowOther: true })];
    expect(checkAnswers(f, { c: "Feira" }, { complete: true, step: 0 }).ok).toBe(true);
  });
});
