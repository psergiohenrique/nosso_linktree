// Formulários: regras puras (sem banco nem rede) para validar o que os sites enviam à API.

export const FORM_LIMITS = {
  answers: 50,
  id: 60,
  label: 300,
  value: 4000,
  pageUrl: 500,
  name: 120,
  phone: 30,
} as const;

export type FormAnswer = { id: string; label: string; value: string };
export type FormResponseStatus = "partial" | "complete";

export type FormResponsePayload = {
  clientId: string;
  status: FormResponseStatus;
  answers: FormAnswer[];
  step: number;
  totalSteps: number;
  contactName: string | null;
  contactPhone: string | null;
  pageUrl: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (raw: unknown, max: number) => (typeof raw === "string" ? raw.trim().slice(0, max) : "");

const int = (raw: unknown, max: number) =>
  typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= max ? raw : null;

/**
 * Lê o corpo de POST /api/forms/respostas. Devolve null se não der para gravar.
 * Respostas vazias são descartadas; textos longos são cortados (não recusados) para não perder o lead.
 * Nome e telefone vêm de `contact`, ou das perguntas de id "nome"/"whatsapp"/"telefone".
 */
export function parseResponsePayload(body: unknown): FormResponsePayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const clientId = str(b.responseId, 36);
  if (!UUID.test(clientId)) return null;

  const status = b.status === "complete" ? "complete" : b.status === "partial" ? "partial" : null;
  if (!status) return null;
  if (!Array.isArray(b.answers) || b.answers.length > FORM_LIMITS.answers) return null;

  const answers: FormAnswer[] = [];
  const seen = new Set<string>();
  for (const raw of b.answers) {
    if (!raw || typeof raw !== "object") return null;
    const a = raw as Record<string, unknown>;
    const id = str(a.id, FORM_LIMITS.id);
    const label = str(a.label, FORM_LIMITS.label);
    const value = str(a.value, FORM_LIMITS.value);
    if (!id || seen.has(id)) return null;
    seen.add(id);
    if (value) answers.push({ id, label: label || id, value });
  }

  const totalSteps = int(b.totalSteps, FORM_LIMITS.answers) ?? 0;
  const step = Math.min(int(b.step, FORM_LIMITS.answers) ?? answers.length, totalSteps || FORM_LIMITS.answers);

  const byId = (...ids: string[]) => answers.find((a) => ids.includes(a.id.toLowerCase()))?.value ?? "";
  const contact = (b.contact && typeof b.contact === "object" ? b.contact : {}) as Record<string, unknown>;
  const contactName = str(contact.name, FORM_LIMITS.name) || byId("nome", "name").slice(0, FORM_LIMITS.name);
  const contactPhone =
    str(contact.phone, FORM_LIMITS.phone) || byId("whatsapp", "telefone", "phone").slice(0, FORM_LIMITS.phone);

  const pageUrl = str(b.pageUrl, FORM_LIMITS.pageUrl);

  return {
    clientId: clientId.toLowerCase(),
    status,
    answers,
    step,
    totalSteps,
    contactName: contactName || null,
    contactPhone: contactPhone || null,
    pageUrl: /^https?:\/\//i.test(pageUrl) ? pageUrl : null,
  };
}

/** "Parou na 4 de 13" a partir das etapas gravadas. */
export function progressLabel(step: number, totalSteps: number) {
  if (!totalSteps) return `${step} respondida${step === 1 ? "" : "s"}`;
  return `${Math.min(step, totalSteps)} de ${totalSteps}`;
}

/** Mensagem pronta para chamar no WhatsApp quem respondeu (ou parou no meio). */
export function followUpMessage(status: FormResponseStatus, name: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0];
  const hello = first ? `Olá, ${first}! Tudo bem?` : "Olá! Tudo bem?";
  return status === "complete"
    ? `${hello} Recebi sua solicitação pelo site e queria conversar sobre ela.`
    : `${hello} Vi que você começou a preencher o formulário no site e queria saber se posso te ajudar a terminar.`;
}

export const formatDateTimeBR = (date: Date) =>
  date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
