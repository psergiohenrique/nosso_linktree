import { describe, expect, it } from "vitest";
import { defaultFields } from "@/lib/form-fields";
import { readProgress } from "@/lib/form-progress";

describe("recuperação do formulário público", () => {
  const fields = defaultFields();
  const progress = {
    id: "12345678-1234-1234-1234-123456789abc",
    fields: JSON.stringify(fields), step: 1,
    answers: { [fields[0].id]: "Ana", escolha: ["A"] }, other: { escolha: "Outra" },
  };

  it("recupera respostas, etapa e texto de Outro juntos com o identificador", () => {
    expect(readProgress(JSON.stringify(progress), fields)).toEqual(progress);
  });

  it("não reutiliza identificador antigo, dados inválidos ou perguntas alteradas", () => {
    expect(readProgress(progress.id, fields)).toBeNull();
    expect(readProgress(JSON.stringify({ ...progress, answers: null }), fields)).toBeNull();
    expect(readProgress(JSON.stringify({ ...progress, step: 99 }), fields)).toBeNull();
    expect(readProgress(JSON.stringify(progress), fields.slice(1))).toBeNull();
  });
});
