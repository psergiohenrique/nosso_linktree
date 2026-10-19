import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import {
  canCancel,
  FREE_FEATURES,
  FREE_LINK_LIMIT,
  formatBRL,
  formatDateBR,
  PRO_FEATURES,
  PRO_PRICES,
  type Cycle,
  type InvoiceStatus,
  type PlanState,
} from "@/lib/billing";
import { requireUser } from "@/server/auth";
import { billingEnabled, getPlan, getSubscription, listInvoices } from "@/server/billing";
import { cancelPro, subscribePro } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plano" };

const CYCLE_LABEL: Record<Cycle, string> = { monthly: "mensal", yearly: "anual" };
const YEARLY_SAVING = PRO_PRICES.monthly.cents * 12 - PRO_PRICES.yearly.cents;

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  open: "Em aberto",
  paid: "Paga",
  failed: "Recusada",
  refunded: "Estornada",
  canceled: "Cancelada",
};

function statusCopy(plan: PlanState): { title: string; text: string; tone: "ok" | "warn" | "neutral" } {
  const until = plan.until ? formatDateBR(plan.until) : "";
  const cycle = plan.cycle ? ` ${CYCLE_LABEL[plan.cycle]}` : "";
  switch (plan.kind) {
    case "active":
      return { title: `Pro${cycle} ativo`, text: `Próxima cobrança em ${until}.`, tone: "ok" };
    case "canceling":
      return {
        title: "Cancelamento pedido",
        text: `Você continua no Pro até ${until}. Depois, sua página volta ao plano Grátis — nada é apagado.`,
        tone: "warn",
      };
    case "past_due":
      return {
        title: "Pagamento pendente",
        text: `Não conseguimos cobrar seu cartão. Atualize até ${until} para não voltar ao plano Grátis.`,
        tone: "warn",
      };
    case "courtesy":
      return {
        title: "Pro de cortesia",
        text: `Liberado até ${until}. Se assinar agora, a primeira cobrança só acontece quando a cortesia acabar.`,
        tone: "ok",
      };
    case "expired":
      return {
        title: "Pro encerrado",
        text: "A cobrança não foi regularizada e sua página voltou ao plano Grátis. Seus links continuam salvos: assine para liberar tudo de novo.",
        tone: "neutral",
      };
    case "canceled":
      return {
        title: "Assinatura cancelada",
        text: "Sua página está no plano Grátis. Seus links continuam salvos: assine para liberar tudo de novo.",
        tone: "neutral",
      };
    default:
      return {
        title: "Plano Grátis",
        text: `Sua página está no ar com até ${FREE_LINK_LIMIT} links e o selo “Feito com Linkbio”.`,
        tone: "neutral",
      };
  }
}

/** Texto do botão de cada ciclo, conforme o estado atual. */
function ctaFor(plan: PlanState, cycle: Cycle): { label: string; current: boolean } {
  const same = plan.cycle === cycle;
  switch (plan.kind) {
    case "active":
      return same ? { label: "Plano atual", current: true } : { label: `Trocar para ${CYCLE_LABEL[cycle]}`, current: false };
    case "canceling":
      return { label: same ? "Reativar" : `Reativar no ${CYCLE_LABEL[cycle]}`, current: false };
    case "past_due":
      return { label: same ? "Atualizar cartão" : `Pagar no ${CYCLE_LABEL[cycle]}`, current: false };
    default:
      return { label: `Assinar ${CYCLE_LABEL[cycle]}`, current: false };
  }
}

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; cancelado?: string; confirmar?: string; error?: string }>;
}) {
  if (!billingEnabled()) notFound();
  const { checkout, cancelado, confirmar, error } = await searchParams;
  const user = await requireUser();
  const [plan, sub, invoices] = await Promise.all([getPlan(user.id), getSubscription(user.id), listInvoices(user.id)]);

  const status = statusCopy(plan);
  const waiting = checkout === "ok" && !(plan.kind === "active" || plan.kind === "canceling");
  const paidUntil = plan.until && ["active", "canceling", "courtesy"].includes(plan.kind) ? plan.until : null;

  return (
    <main className="dash-wide plan-page">
      <div className="dash-head">
        <p className="eyebrow">Plano</p>
        <h1 className="h2 dash-h1">Seu plano</h1>
      </div>

      <AutoRefresh active={waiting} />
      {waiting && (
        <p className="notice notice-ok">
          Recebemos você de volta. Estamos confirmando o pagamento com o banco — isso leva alguns segundos.
        </p>
      )}
      {checkout === "ok" && !waiting && <p className="notice notice-ok">Tudo certo! Seu plano Pro está ativo.</p>}
      {checkout === "cancelado" && <p className="notice notice-error">Você saiu antes de concluir. Nada foi cobrado.</p>}
      {checkout === "expirado" && <p className="notice notice-error">O link de pagamento expirou. Gere outro abaixo.</p>}
      {cancelado && plan.until && (
        <p className="notice notice-ok">Assinatura cancelada. Você continua no Pro até {formatDateBR(plan.until)}.</p>
      )}
      {error && <p className="notice notice-error">{error}</p>}

      <section className={`card plan-status plan-status-${status.tone}`}>
        <h2 className="card-title">{status.title}</h2>
        <p>{status.text}</p>
        {sub?.card_last4 && (plan.kind === "active" || plan.kind === "past_due") && (
          <p className="hint">
            Cartão {sub.card_brand ?? ""} •••• {sub.card_last4}
          </p>
        )}
      </section>

      {confirmar === "cancelar" && canCancel(plan, sub) && (
        <section className="card plan-confirm">
          <h2 className="card-title">Cancelar a assinatura?</h2>
          <p>
            {plan.until && plan.kind === "active"
              ? `Você continua no Pro até ${formatDateBR(plan.until)} e não haverá novas cobranças. Depois, a página volta ao plano Grátis: mostra os ${FREE_LINK_LIMIT} primeiros links, como botão e com o selo. Nada é apagado.`
              : "Não haverá novas cobranças e sua página volta ao plano Grátis. Nada é apagado."}
          </p>
          <div className="card-row">
            <form action={cancelPro} data-posthog-event="pro_subscription_cancelled">
              <button className="btn btn-outline btn-sm btn-danger">Sim, cancelar</button>
            </form>
            <Link href="/dashboard/plano" className="btn btn-primary btn-sm">
              Manter o Pro
            </Link>
          </div>
        </section>
      )}

      <div className="plan-grid">
        <section className={`plan-card ${plan.pro ? "" : "plan-card-current"}`}>
          <p className="plan-name">Grátis</p>
          <p className="plan-price">
            R$ 0<span>/sempre</span>
          </p>
          <ul className="plan-feats">
            {FREE_FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {!plan.pro && <p className="plan-current-tag">Seu plano atual</p>}
        </section>

        {(["monthly", "yearly"] as const).map((cycle) => {
          const price = PRO_PRICES[cycle];
          const cta = ctaFor(plan, cycle);
          return (
            <section key={cycle} className={`plan-card plan-card-pro ${cta.current ? "plan-card-current" : ""}`}>
              <p className="plan-name">
                Pro {CYCLE_LABEL[cycle]}
                {cycle === "yearly" && <span className="plan-save">economize {formatBRL(YEARLY_SAVING)}</span>}
              </p>
              <p className="plan-price">
                {price.price}
                <span>{price.per}</span>
              </p>
              {cycle === "yearly" && <p className="hint">Equivale a {formatBRL(price.cents / 12)} por mês.</p>}
              <ul className="plan-feats">
                {PRO_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {cta.current ? (
                <p className="plan-current-tag">Seu plano atual</p>
              ) : (
                <form action={subscribePro} data-posthog-event="pro_checkout_started" data-posthog-cycle={cycle}>
                  <input type="hidden" name="cycle" value={cycle} />
                  <button className={`btn ${cycle === "yearly" ? "btn-lime" : "btn-primary"}`}>{cta.label}</button>
                </form>
              )}
            </section>
          );
        })}
      </div>

      <p className="hint plan-note">
        Pagamento seguro pelo Asaas, com cartão de crédito e renovação automática. Cancele quando quiser: o Pro vale até o
        fim do período pago.
        {paidUntil && ` Ao trocar de plano ou reativar, a nova cobrança só começa em ${formatDateBR(paidUntil)}.`}
      </p>

      {canCancel(plan, sub) && (
        <section className="card">
          <h2 className="card-title">Gerenciar assinatura</h2>
          <p className="auth-text">
            Para trocar o cartão, assine de novo o mesmo plano: o novo cartão é digitado na página do Asaas e a assinatura
            antiga é encerrada sem cobrança dupla.
          </p>
          <div className="card-row">
            {plan.cycle && (
              <form action={subscribePro} data-posthog-event="pro_checkout_started" data-posthog-cycle={plan.cycle}>
                <input type="hidden" name="cycle" value={plan.cycle} />
                <button className="btn btn-outline btn-sm">Trocar cartão</button>
              </form>
            )}
            <Link href="/dashboard/plano?confirmar=cancelar" className="btn btn-outline btn-sm btn-danger">
              Cancelar assinatura
            </Link>
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <section className="card stat-card">
          <h2 className="card-title">Cobranças</h2>
          <table className="rank">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th className="num">Valor</th>
                <th>Situação</th>
                <th className="num">Recibo</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{formatDateBR(inv.due_at)}</td>
                  <td className="num">{formatBRL(inv.amount_cents)}</td>
                  <td>{INVOICE_LABEL[inv.status]}</td>
                  <td className="num">
                    {inv.receipt_url ? (
                      <a href={inv.receipt_url} target="_blank" rel="noopener noreferrer">
                        Recibo
                      </a>
                    ) : inv.invoice_url ? (
                      <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                        Fatura
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
