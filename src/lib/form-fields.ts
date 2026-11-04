// Perguntas dos formulários montados no painel: tipos, limites e validação (sem banco nem rede).
// Usado no construtor (cliente), na página pública (cliente) e no servidor, que valida de novo.

import type { FormAnswer } from "./forms";

export const FIELD_TYPES = ["text", "textarea", "tel", "email", "radio", "checkbox"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Resposta curta",
  textarea: "Resposta longa",
  tel: "WhatsApp / telefone",
  email: "E-mail",
  radio: "Escolha uma opção",
  checkbox: "Várias opções",
};

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  description: string;
  required: boolean;
  /** Só em radio/checkbox. */
  options: string[];
  /** radio/checkbox: aceita "Outro" com texto livre. */
  allowOther: boolean;
};

export const FIELD_LIMITS = {
  fields: 30,
  label: 200,
  description: 300,
  options: 15,
  option: 120,
  other: 200,
  title: 120,
  intro: 500,
  thankYou: 300,
  name: 80,
} as const;

/** Tamanho máximo da resposta por tipo. */
export const ANSWER_MAX: Record<FieldType, number> = {
  text: 300,
  textarea: 4000,
  tel: 30,
  email: 200,
  radio: FIELD_LIMITS.other,
  checkbox: 2000,
};

export const OTHER_LABEL = "Outro";

const isChoice = (type: FieldType) => type === "radio" || type === "checkbox";

const newId = () => `q${Math.random().toString(36).slice(2, 10)}`;

export function blankField(type: FieldType = "text"): FormField {
  return {
    id: newId(),
    type,
    label: "",
    description: "",
    required: true,
    options: isChoice(type) ? ["Opção 1", "Opção 2"] : [],
    allowOther: false,
  };
}

/** Perguntas de um formulário novo: o básico para chamar a pessoa de volta. */
export function defaultFields(): FormField[] {
  return [
    { ...blankField("text"), label: "Qual o seu nome?" },
    { ...blankField("tel"), label: "Qual o seu WhatsApp?" },
    { ...blankField("textarea"), label: "Como posso te ajudar?", required: false },
  ];
}

export function validateFormSlug(raw: string): string | null {
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return /^[a-z0-9-]{2,40}$/.test(slug) ? slug : null;
}

const str = (raw: unknown, max: number) => (typeof raw === "string" ? raw.trim().slice(0, max) : "");

/**
 * Lê as perguntas salvas pelo construtor. Corta textos longos, descarta opções vazias/repetidas.
 * Devolve erro (em português, para mostrar no painel) quando não dá para salvar.
 */
export function parseFields(raw: unknown): { fields: FormField[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Perguntas inválidas." };
  if (raw.length === 0) return { error: "Adicione pelo menos uma pergunta." };
  if (raw.length > FIELD_LIMITS.fields) return { error: `No máximo ${FIELD_LIMITS.fields} perguntas.` };

  const fields: FormField[] = [];
  const ids = new Set<string>();
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== "object") return { error: "Perguntas inválidas." };
    const f = item as Record<string, unknown>;
    const type = FIELD_TYPES.includes(f.type as FieldType) ? (f.type as FieldType) : null;
    if (!type) return { error: `Pergunta ${i + 1}: tipo inválido.` };
    const label = str(f.label, FIELD_LIMITS.label);
    if (!label) return { error: `Pergunta ${i + 1}: escreva a pergunta.` };

    let id = str(f.id, 20);
    if (!/^[a-z0-9_-]{1,20}$/i.test(id) || ids.has(id)) id = newId();
    ids.add(id);

    const options = isChoice(type)
      ? [
          ...new Set(
            (Array.isArray(f.options) ? f.options : [])
              .map((o) => str(o, FIELD_LIMITS.option))
              .filter((o) => o && o !== OTHER_LABEL),
          ),
        ].slice(0, FIELD_LIMITS.options)
      : [];
    if (isChoice(type) && options.length === 0) return { error: `Pergunta ${i + 1}: adicione as opções.` };

    fields.push({
      id,
      type,
      label,
      description: str(f.description, FIELD_LIMITS.description),
      required: f.required !== false,
      options,
      allowOther: isChoice(type) && f.allowOther === true,
    });
  }
  return { fields };
}

/** Lê o que já está gravado (confiável, mas pode ser de uma versão antiga). */
export function storedFields(raw: unknown): FormField[] | null {
  if (raw == null) return null;
  const parsed = parseFields(raw);
  return "fields" in parsed ? parsed.fields : [];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Escolhas marcadas (só em checkbox), sem vazias nem repetidas. */
function checkedList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" && raw ? [raw] : [];
  return [...new Set(list.map((v) => str(v, FIELD_LIMITS.other)).filter(Boolean))];
}

/** Junta a resposta em texto (várias opções viram "A, B"). */
function answerText(field: FormField, raw: unknown): string {
  if (field.type === "checkbox") return checkedList(raw).join(", ").slice(0, ANSWER_MAX.checkbox);
  return str(raw, ANSWER_MAX[field.type]);
}

/**
 * Erro da resposta de uma pergunta, ou null. `value` é a resposta em texto;
 * em checkbox, `picked` são as opções marcadas (uma opção pode ter vírgula).
 */
export function answerError(field: FormField, value: string, picked: string[] = []): string | null {
  if (!value) return field.required ? "Esta resposta é obrigatória." : null;
  if (field.type === "tel" && value.replace(/\D/g, "").length < 10) return "Informe um número com DDD.";
  if (field.type === "email" && !EMAIL.test(value)) return "Informe um e-mail válido.";
  if (field.type === "radio" && !field.allowOther && !field.options.includes(value)) return "Escolha uma das opções.";
  if (field.type === "checkbox" && !field.allowOther && picked.some((v) => !field.options.includes(v))) {
    return "Escolha entre as opções.";
  }
  return null;
}

export type CheckedAnswers =
  | { ok: true; answers: FormAnswer[]; contactName: string | null; contactPhone: string | null }
  | { ok: false; fieldId: string; error: string };

/**
 * Confere as respostas enviadas pela página pública contra as perguntas do formulário.
 * Parcial: só as perguntas até `step` (as que a pessoa já passou) são conferidas.
 * Completa: todas. Nome = primeira resposta curta; telefone = primeira pergunta de telefone.
 */
export function checkAnswers(
  fields: FormField[],
  raw: unknown,
  { complete, step }: { complete: boolean; step: number },
): CheckedAnswers {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const upTo = complete ? fields.length : Math.min(Math.max(step, 0), fields.length);
  const answers: FormAnswer[] = [];

  for (const [i, field] of fields.entries()) {
    const value = answerText(field, input[field.id]);
    const picked = field.type === "checkbox" ? checkedList(input[field.id]) : [];
    const error = answerError(field, value, picked);
    if (i < upTo && error) return { ok: false, fieldId: field.id, error };
    // Além da etapa atual, só guarda o que já é válido (a pessoa pode ter voltado uma etapa).
    if (value && (i < upTo || !error)) answers.push({ id: field.id, label: field.label, value });
  }

  const valueOf = (type: FieldType) => {
    const f = fields.find((x) => x.type === type);
    return f ? (answers.find((a) => a.id === f.id)?.value ?? null) : null;
  };
  return {
    ok: true,
    answers,
    contactName: valueOf("text")?.slice(0, 120) ?? null,
    contactPhone: valueOf("tel")?.slice(0, 30) ?? null,
  };
}
