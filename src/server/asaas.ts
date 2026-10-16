import "server-only";

/**
 * Cliente mínimo da API v3 do Asaas (mesmo formato usado no Ambiento): só o que a cobrança usa.
 * ASAAS_API_URL escolhe o ambiente (padrão: sandbox); a chave nunca é logada.
 */

const SANDBOX_API = "https://api-sandbox.asaas.com/v3";

export class AsaasError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Asaas respondeu ${status}`);
    this.name = "AsaasError";
  }
}

const apiUrl = () => (process.env.ASAAS_API_URL || SANDBOX_API).replace(/\/$/, "");

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  const response = await fetch(`${apiUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      // Obrigatório em contas novas; sem ele o Asaas responde 400.
      "User-Agent": "linkbio",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    console.warn(`[asaas] ${method} ${path} → ${response.status}`);
    throw new AsaasError(response.status, parsed);
  }
  return parsed as T;
}

/** Data no formato do Asaas, em horário de Brasília (em UTC, depois das 21h viraria o dia seguinte). */
export function asaasDate(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).concat(" 12:00:00");
}

export type CheckoutInput = {
  externalReference: string;
  name: string;
  valueCents: number;
  cycle: "MONTHLY" | "YEARLY";
  nextDueDate: Date;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
};

/**
 * Checkout hospedado do Asaas com cartão recorrente. Sem `customer`: o Asaas recusa cliente
 * incompleto, então o próprio cliente preenche os dados na página (como no Ambiento).
 */
export async function createCheckout(input: CheckoutInput) {
  const checkout = await call<{ id: string; link: string }>("POST", "/checkouts", {
    externalReference: input.externalReference,
    billingTypes: ["CREDIT_CARD"],
    chargeTypes: ["RECURRENT"],
    minutesToExpire: 60,
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl },
    items: [{ name: input.name, description: input.name, quantity: 1, value: input.valueCents / 100 }],
    subscription: { cycle: input.cycle, nextDueDate: asaasDate(input.nextDueDate) },
  });
  return { id: checkout.id, url: checkout.link };
}

/** Cancela a assinatura no Asaas. Já removida (404) conta como feito. */
export async function cancelGatewaySubscription(id: string) {
  try {
    await call("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof AsaasError && err.status === 404) return;
    throw err;
  }
}

// ───────── Envelope do webhook (tipado só no que é lido; campos novos não quebram nada) ─────────

export type AsaasPayment = {
  id: string;
  customer?: string;
  subscription?: string | null;
  externalReference?: string | null;
  value?: number;
  dueDate?: string;
  status?: string;
  invoiceUrl?: string;
  transactionReceiptUrl?: string | null;
  creditCard?: { creditCardBrand?: string; creditCardNumber?: string };
};

export type AsaasEnvelope = {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: { id: string; customer?: string; externalReference?: string | null; cycle?: string };
  checkout?: { id: string; customer?: string; externalReference?: string | null };
};

export function isEnvelope(body: unknown): body is AsaasEnvelope {
  if (typeof body !== "object" || body === null) return false;
  const { id, event } = body as Record<string, unknown>;
  return typeof id === "string" && id !== "" && typeof event === "string" && event !== "";
}
