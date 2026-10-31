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
  "Resumo semanal por e-mail",
  "Selo “Feito com Linkbio”",
];

export const PRO_FEATURES = [
  "Links ilimitados",
  "Formatos Destaque e Bloco",
  "Resultados de 30 e 90 dias",
  "Horários de pico, cidades, campanhas e CSV",
  "Sem o selo “Feito com Linkbio”",
  "0% de comissão, sempre",
];

export type SubscriptionStatus = "pending" | "active" | "past_due" | "expired";

/** Acesso agora. Business inclui tudo do Pro. */
export type PlanTier = "free" | "pro" | "business";
/** Produto gravado em subscriptions.plan. Não é um preço: o Business ainda não tem valor. */
export type PaidPlan = "pro" | "business";

export type SubscriptionRow = {
  status: SubscriptionStatus;
  /** Produto da linha. Default no banco: pro. Cortesia não promove isto a Business. */
  plan: PaidPlan;
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
  /** true para Pro e Business (e para cortesia e lançamento, que continuam sendo Pro). */
  pro: boolean;
  /** Acesso agora. Lançamento e cortesia são Pro: não liberam o que é só do Business. */
  tier: PlanTier;
  /** Produto da assinatura, mesmo vencida. Null sem linha em subscriptions. */
  product: PaidPlan | null;
  kind: PlanKind;
  /** Até quando o acesso pago vale (fim do período, da carência ou da cortesia). */
  until: Date | null;
  cycle: Cycle | null;
};

const DAY = 86_400_000;
const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, business: 2 };

/** Estado do plano, sempre calculado na leitura (nada depende de um job ter rodado). */
export function planState(
  sub: SubscriptionRow | null,
  { billingEnabled, now = new Date() }: { billingEnabled: boolean; now?: Date },
): PlanState {
  // Cobrança desligada: todos têm o Pro, não o Business. O que é só do Business continua fechado.
  if (!billingEnabled) return { pro: true, tier: "pro", product: null, kind: "launch", until: null, cycle: null };

  const paid = paidState(sub, now);
  if (paid.pro || !sub?.courtesy_until || sub.courtesy_until <= now) return paid;
  // Cortesia segue dando só o Pro, mesmo que a linha tenha sido Business um dia.
  return { pro: true, tier: "pro", product: sub.plan, kind: "courtesy", until: sub.courtesy_until, cycle: null };
}

/** Business inclui o Pro. Cortesia e lançamento contam como Pro, não como Business. */
export function hasTier(state: PlanState, tier: PlanTier) {
  return TIER_RANK[state.tier] >= TIER_RANK[tier];
}

function paidState(sub: SubscriptionRow | null, now: Date): PlanState {
  const cycle = sub?.cycle ?? null;
  const product = sub?.plan ?? null;
  const tier: PlanTier = product === "business" ? "business" : "pro";
  const open = (kind: PlanKind, until: Date | null): PlanState => ({
    pro: true,
    tier,
    product,
    kind,
    until,
    cycle,
  });
  const closed = (kind: PlanKind): PlanState => ({
    pro: false,
    tier: "free",
    product,
    kind,
    until: null,
    cycle,
  });

  if (!sub) return closed("free");

  if (sub.status === "active" && sub.current_period_end) {
    const end = sub.current_period_end;
    if (sub.canceled_at) return end > now ? open("canceling", end) : closed("canceled");
    if (end.getTime() + RENEWAL_TOLERANCE_DAYS * DAY > now.getTime()) return open("active", end);
    return closed("expired");
  }
  if (sub.status === "past_due") {
    return sub.grace_ends_at && sub.grace_ends_at > now ? open("past_due", sub.grace_ends_at) : closed("expired");
  }
  if (sub.status === "expired") return closed("expired");
  return closed("free");
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

/**
 * Ciclo de uma cobrança antiga pelo valor. O pagamento do Asaas não diz o ciclo, e os
 * checkouts anteriores a 0014 não gravaram um. Só os preços do Pro de hoje passam por aqui
 * (R$ 9,90 mensal, R$ 70,80 anual). Cobrança nova usa o ciclo do checkout: ver periodForCycle.
 */
export function cycleForAmount(cents: number): Cycle {
  return cents >= PRO_PRICES.yearly.cents / 2 ? "yearly" : "monthly";
}

/**
 * Meses que a cobrança cobre. O ciclo gravado no checkout vence: o valor não decide,
 * então um segundo preço não é lido como o anual do Pro. Sem ciclo (checkout antigo),
 * continua a dedução pelo valor, que para R$ 9,90 e R$ 70,80 dá o mesmo de antes.
 */
export function periodForCycle(cycle: Cycle | null, cents: number): { cycle: Cycle; months: number } {
  const resolved = cycle ?? cycleForAmount(cents);
  return { cycle: resolved, months: PRO_PRICES[resolved].months };
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

// ───────── Página pública ─────────

export type LinkAccess = {
  pro: boolean;
  /** Bloco Pix na página pública. Só o Business, e só com o recurso ligado. */
  pix?: boolean;
};

/**
 * O que a página mostra. Fora do Business (ou com o Pix desligado) o bloco some, sem apagar.
 * No Grátis, os primeiros links ativos, todos como botão. Um Pix oculto não ocupa uma das vagas.
 */
export function applyPlanToLinks<T extends { layout: LinkLayout; kind?: string }>(
  links: T[],
  access: boolean | LinkAccess,
): T[] {
  const pro = typeof access === "boolean" ? access : access.pro;
  const pix = typeof access === "boolean" ? false : access.pix === true;
  const visible = !pix && links.some((l) => l.kind === "pix") ? links.filter((l) => l.kind !== "pix") : links;
  if (pro) return visible;
  return visible.slice(0, FREE_LINK_LIMIT).map((l) => (l.layout === "button" ? l : { ...l, layout: "button" }));
}

export const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const formatDateBR = (date: Date) =>
  date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
