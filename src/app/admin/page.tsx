import type { Metadata } from "next";
import Link from "next/link";
import { formatBRL, formatDateBR, type PlanKind } from "@/lib/billing";
import { getAdminSummary, listAccounts, listRecentInvoices, requireAdmin } from "@/server/admin";
import { billingEnabled } from "@/server/billing";
import { InvoiceTag, PLAN_LABEL, PlanTag, dateOrDash } from "./format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Resumo" };

const PLAN_ORDER: PlanKind[] = ["active", "canceling", "past_due", "courtesy", "free", "expired", "canceled"];

export default async function AdminPage() {
  await requireAdmin();
  const [summary, invoices, recent] = await Promise.all([
    getAdminSummary(),
    listRecentInvoices(20),
    listAccounts({ page: 1 }),
  ]);
  const pro = summary.plans.active + summary.plans.canceling + summary.plans.past_due + summary.plans.courtesy;

  return (
    <main className="dash-wide admin">
      <div className="dash-head">
        <p className="eyebrow">Admin</p>
        <h1 className="h2 dash-h1">Resumo</h1>
      </div>

      {!billingEnabled() && (
        <p className="notice notice-ok">
          A cobrança está desligada (BILLING_ENABLED): na prática todos têm o Pro. Os planos abaixo mostram o estado real
          das assinaturas.
        </p>
      )}

      <div className="kpis admin-kpis">
        <div className="kpi">
          <div className="kpi-num">{summary.users}</div>
          <div className="kpi-label">Cadastros</div>
          <span className="kpi-delta">+{summary.new7} em 7 dias · +{summary.new30} em 30</span>
        </div>
        <div className="kpi">
          <div className="kpi-num">{summary.verified}</div>
          <div className="kpi-label">E-mail confirmado</div>
          <span className="kpi-delta">{summary.withPage} com página criada</span>
        </div>
        <div className="kpi">
          <div className="kpi-num">{pro}</div>
          <div className="kpi-label">Com Pro</div>
          <span className="kpi-delta">{summary.plans.courtesy} de cortesia</span>
        </div>
        <div className="kpi kpi-whats">
          <div className="kpi-num">{formatBRL(summary.mrrCents)}</div>
          <div className="kpi-label">MRR estimado</div>
          <span className="kpi-delta">{summary.plans.active} assinaturas ativas</span>
        </div>
        <div className="kpi">
          <div className="kpi-num">{formatBRL(summary.paidMonthCents)}</div>
          <div className="kpi-label">Recebido no mês</div>
          <span className="kpi-delta">{formatBRL(summary.paid30Cents)} em 30 dias</span>
        </div>
      </div>

      <div className="stat-cols">
        <section className="card stat-card">
          <h2 className="card-title">Contas por plano</h2>
          <table className="rank">
            <tbody>
              {PLAN_ORDER.map((kind) => (
                <tr key={kind}>
                  <td>{PLAN_LABEL[kind]}</td>
                  <td className="num">{summary.plans[kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card stat-card">
          <h2 className="card-title">Pagamentos</h2>
          <table className="rank">
            <tbody>
              <tr>
                <td>Total recebido</td>
                <td className="num">{formatBRL(summary.paidTotalCents)}</td>
              </tr>
              <tr>
                <td>Total estornado</td>
                <td className="num">{formatBRL(summary.refundedTotalCents)}</td>
              </tr>
              <tr>
                <td>Cobranças recusadas (30 dias)</td>
                <td className="num">{summary.failed30}</td>
              </tr>
              <tr>
                <td>Em carência agora</td>
                <td className="num">{summary.plans.past_due}</td>
              </tr>
              <tr>
                <td>Cancelamentos pendentes</td>
                <td className="num">{summary.plans.canceling}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="card stat-card">
        <div className="card-row">
          <h2 className="card-title">Cobranças recentes</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="dash-empty">Nenhuma cobrança ainda.</p>
        ) : (
          <div className="admin-scroll">
            <table className="rank">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Vencimento</th>
                  <th>Pago em</th>
                  <th className="num">Valor</th>
                  <th>Situação</th>
                  <th className="num">Asaas</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/admin/contas/${inv.user_id}`}>{inv.email}</Link>
                    </td>
                    <td>{formatDateBR(inv.due_at)}</td>
                    <td>{dateOrDash(inv.paid_at)}</td>
                    <td className="num">{formatBRL(inv.amount_cents)}</td>
                    <td>
                      <InvoiceTag status={inv.status} />
                    </td>
                    <td className="num">
                      {inv.invoice_url ? (
                        <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                          Fatura ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stat-card">
        <div className="card-row">
          <h2 className="card-title">Cadastros recentes</h2>
          <Link href="/admin/contas" className="btn btn-outline btn-sm">
            Ver todas as contas
          </Link>
        </div>
        <div className="admin-scroll">
          <table className="rank">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Página</th>
                <th>Cadastro</th>
                <th>Plano</th>
              </tr>
            </thead>
            <tbody>
              {recent.accounts.slice(0, 10).map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/contas/${a.id}`}>{a.name || a.email}</Link>
                    {a.name && <div className="hint">{a.email}</div>}
                  </td>
                  <td>{a.slug ? `/${a.slug}` : "—"}</td>
                  <td>{formatDateBR(a.created_at)}</td>
                  <td>
                    <PlanTag plan={a.plan} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
