// Planos e regras de cobrança, sem acesso a banco nem rede (testáveis e usáveis no cliente).
import type { LinkLayout } from "./types";

export const FREE_LINK_LIMIT = 5;
export const FREE_STATS_DAYS = 7;
/** Dias de Pro mantidos depois de uma cobrança recusada, para o cliente trocar o cartão. */
export const GRACE_DAYS = 7;
/** Folga depois do fim do período antes de considerar que a renovação não veio. */
export const RENEWAL_TOLERANCE_DAYS = 3;

export type Cycle = "monthly" | "yearly";

export const PRO_PRICES: Record<
  Cycle,
  { cents: number; price: string; per: string; months: number; asaasCycle: "MONTHLY" | "YEARLY"; name: string }
> = {
  monthly: { cents: 990, price: "R$ 9,90", per: "/mês", months: 1, asaasCycle: "MONTHLY", name: "Linkbio Pro mensal" },
  // R$ 5,90 por mês, cobrados de uma vez no ano.
  yearly: { cents: 7080, price: "R$ 70,80", per: "/ano", months: 12, asaasCycle: "YEARLY", name: "Linkbio Pro anual" },
};

export const FREE_FEATURES = [
  `Até ${FREE_LINK_LIMIT} links`,
  "Botão de WhatsApp",
  "Temas, cores, botões e fontes",
  `Resultados dos últimos ${FREE_STATS_DAYS} dias`,
  "Selo “Feito com Linkbio”",
];

export const PRO_FEATURES = [
  "Links ilimitados",
  "Formatos Destaque e Bloco",
  "Resultados de 30 e 90 dias",
  "Sem o selo “Feito com Linkbio”",
  "0% de comissão, sempre",
];

export type SubscriptionStatus = "pending" | "active" | "past_due" | "expired";

export type SubscriptionRow = {
  status: SubscriptionStatus;
  cycle: Cycle;
  current_period_end: Date | null;
  grace_ends_at: Date | null;
  canceled_at: Date | null;
  courtesy_until: Date | null;
  gateway_subscription_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
};

export type PlanKind =
  | "launch" // cobrança desligada: todos têm o Pro
  | "free"
  | "courtesy"
  | "active"
  | "canceling" // cancelou, mas o período pago ainda vale
  | "past_due" // cobrança falhou, em carência
  | "expired" // carência acabou ou a renovação não veio
  | "canceled"; // cancelou e o período acabou

export type PlanState = {
  pro: boolean;
  kind: PlanKind;
  /** Até quando o Pro vale (fim do período, da carência ou da cortesia). */
  until: Date | null;
  cycle: Cycle | null;
};

const DAY = 86_400_000;

/** Estado do plano, sempre calculado na leitura (nada depende de um job ter rodado). */
export function planState(
  sub: SubscriptionRow | null,
  { billingEnabled, now = new Date() }: { billingEnabled: boolean; now?: Date },
): PlanState {
  if (!billingEnabled) return { pro: true, kind: "launch", until: null, cycle: null };

  const paid = paidState(sub, now);
  if (paid.pro || !sub?.courtesy_until || sub.courtesy_until <= now) return paid;
  return { pro: true, kind: "courtesy", until: sub.courtesy_until, cycle: null };
}

function paidState(sub: SubscriptionRow | null, now: Date): PlanState {
  const base = { cycle: sub?.cycle ?? null };
  if (!sub) return { ...base, pro: false, kind: "free", until: null };

  if (sub.status === "active" && sub.current_period_end) {
    const end = sub.current_period_end;
    if (sub.canceled_at) {
      return end > now
        ? { ...base, pro: true, kind: "canceling", until: end }
        : { ...base, pro: false, kind: "canceled", until: null };
    }
    if (end.getTime() + RENEWAL_TOLERANCE_DAYS * DAY > now.getTime()) {
      return { ...base, pro: true, kind: "active", until: end };
    }
    return { ...base, pro: false, kind: "expired", until: null };
  }
  if (sub.status === "past_due") {
    return sub.grace_ends_at && sub.grace_ends_at > now
      ? { ...base, pro: true, kind: "past_due", until: sub.grace_ends_at }
      : { ...base, pro: false, kind: "expired", until: null };
  }
  if (sub.status === "expired") return { ...base, pro: false, kind: "expired", until: null };
  return { ...base, pro: false, kind: "free", until: null };
}

/** Pode abrir um checkout: assinar, reativar, trocar de ciclo ou de cartão. */
export function canCheckout(state: PlanState) {
  return state.kind !== "launch";
}

/** Tem assinatura viva no Asaas para cancelar. */
export function canCancel(state: PlanState, sub: SubscriptionRow | null) {
  return (state.kind === "active" || state.kind === "past_due") && !!sub?.gateway_subscription_id;
}

// ───────── Faturas ─────────

export type InvoiceStatus = "open" | "paid" | "failed" | "refunded" | "canceled";

export const INVOICE_STATUS_BY_EVENT: Record<string, InvoiceStatus> = {
  PAYMENT_CREATED: "open",
  // No cartão, CONFIRMED já é dinheiro garantido; RECEIVED chega ~30 dias depois e não muda nada.
  PAYMENT_CONFIRMED: "paid",
  PAYMENT_RECEIVED: "paid",
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "failed",
  PAYMENT_OVERDUE: "failed",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_DELETED: "canceled",
};

const INVOICE_RANK: Record<InvoiceStatus, number> = { open: 0, failed: 1, paid: 2, refunded: 3, canceled: 3 };

/**
 * O Asaas entrega fora de ordem: um evento atrasado não desfaz o que já se sabe.
 * Paga não volta a aberta; só estorno ou cancelamento a superam. Falha ainda pode virar paga.
 */
export function nextInvoiceStatus(current: InvoiceStatus, incoming: InvoiceStatus): InvoiceStatus {
  return INVOICE_RANK[incoming] >= INVOICE_RANK[current] ? incoming : current;
}

/** Ciclo de uma cobrança pelo valor (o pagamento do Asaas não diz o ciclo). */
export function cycleForAmount(cents: number): Cycle {
  return cents >= PRO_PRICES.yearly.cents / 2 ? "yearly" : "monthly";
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

// ───────── Página pública ─────────

/** O que o plano Grátis mostra: os primeiros links ativos, todos como botão. */
export function applyPlanToLinks<T extends { layout: LinkLayout }>(links: T[], pro: boolean): T[] {
  if (pro) return links;
  return links.slice(0, FREE_LINK_LIMIT).map((l) => (l.layout === "button" ? l : { ...l, layout: "button" }));
}

export const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const formatDateBR = (date: Date) =>
  date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
