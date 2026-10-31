import { formatDateBR, type InvoiceStatus, type PlanKind, type PlanState } from "@/lib/billing";

export const PLAN_LABEL: Record<PlanKind, string> = {
  launch: "Lançamento",
  free: "Grátis",
  courtesy: "Cortesia",
  active: "Pro ativo",
  canceling: "Cancelando",
  past_due: "Em carência",
  expired: "Expirado",
  canceled: "Cancelado",
};

export const PLAN_TONE: Record<PlanKind, "ok" | "warn" | "bad" | "neutral"> = {
  launch: "neutral",
  free: "neutral",
  courtesy: "ok",
  active: "ok",
  canceling: "warn",
  past_due: "bad",
  expired: "neutral",
  canceled: "neutral",
};

export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  open: "Em aberto",
  paid: "Paga",
  failed: "Recusada",
  refunded: "Estornada",
  canceled: "Cancelada",
};

const INVOICE_TONE: Record<InvoiceStatus, "ok" | "warn" | "bad" | "neutral"> = {
  open: "warn",
  paid: "ok",
  failed: "bad",
  refunded: "neutral",
  canceled: "neutral",
};

/** Rótulo do estado. Pro mantém os textos de hoje; Business aparece pelo nome. */
export function planLabel(plan: PlanState): string {
  if (plan.product === "business" || plan.tier === "business") {
    if (plan.kind === "active") return "Business ativo";
    if (plan.kind === "canceling") return "Business cancelando";
    if (plan.kind === "past_due") return "Business em carência";
    if (plan.kind === "expired") return "Business expirado";
    if (plan.kind === "canceled") return "Business cancelado";
  }
  return PLAN_LABEL[plan.kind];
}

export function PlanTag({ plan }: { plan: PlanState }) {
  const cycle = plan.cycle && ["active", "canceling", "past_due"].includes(plan.kind)
    ? plan.cycle === "yearly" ? " · anual" : " · mensal"
    : "";
  return (
    <span className={`admin-tag admin-tag-${PLAN_TONE[plan.kind]}`}>
      {planLabel(plan)}
      {cycle}
    </span>
  );
}

export function InvoiceTag({ status }: { status: InvoiceStatus }) {
  return <span className={`admin-tag admin-tag-${INVOICE_TONE[status]}`}>{INVOICE_LABEL[status]}</span>;
}

export const formatDateTimeBR = (date: Date) =>
  date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const dateOrDash = (date: Date | null | undefined) => (date ? formatDateBR(date) : "—");
