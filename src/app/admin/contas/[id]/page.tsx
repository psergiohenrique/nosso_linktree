import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBRL, formatDateBR } from "@/lib/billing";
import { getAccountDetail, requireAdmin } from "@/server/admin";
import { billingEnabled } from "@/server/billing";
import { removeCourtesy, setCourtesy } from "../../actions";
import { InvoiceTag, PlanTag, dateOrDash, formatDateTimeBR } from "../../format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Conta" };

const OK_COPY: Record<string, string> = {
  cortesia: "Cortesia salva.",
  "sem-cortesia": "Cortesia removida.",
};

/** Data no formato do <input type="date">, no horário de Brasília. */
const isoDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Datas do formulário de cortesia: mínimo amanhã; padrão a cortesia atual ou daqui a 30 dias. */
function courtesyDates(current: Date | null | undefined) {
  const now = Date.now();
  const active = !!current && current.getTime() > now;
  return {
    active,
    min: isoDay(new Date(now + 86_400_000)),
    initial: isoDay(active ? current : new Date(now + 30 * 86_400_000)),
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

export default async function AdminAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const detail = await getAccountDetail(id);
  if (!detail) notFound();

  const { user, profile, links, sub, plan, invoices, stats, sessions, checkouts } = detail;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount_cents, 0);
  const courtesy = courtesyDates(sub?.courtesy_until);

  return (
    <main className="dash-wide admin">
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">
            <Link href="/admin/contas">← Contas</Link>
          </p>
          <h1 className="h2 dash-h1">{name || user.email}</h1>
          <p className="hint">{user.email}</p>
        </div>
        <div className="dash-head-actions">
          <PlanTag plan={plan} />
          {profile && (
            <a href={`/${profile.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              /{profile.slug} ↗
            </a>
          )}
        </div>
      </div>

      {ok && OK_COPY[ok] && <p className="notice notice-ok">{OK_COPY[ok]}</p>}
      {error && <p className="notice notice-error">{error}</p>}

      <div className="kpis admin-kpis">
        <div className="kpi">
          <div className="kpi-num">{stats.views}</div>
          <div className="kpi-label">Visitas 30d</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{stats.visitors}</div>
          <div className="kpi-label">Visitantes 30d</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{stats.clicks}</div>
          <div className="kpi-label">Cliques 30d</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{links.length}</div>
          <div className="kpi-label">Links</div>
        </div>
        <div className="kpi kpi-whats">
          <div className="kpi-num">{formatBRL(paidTotal)}</div>
          <div className="kpi-label">Total pago</div>
        </div>
      </div>

      <div className="stat-cols">
        <section className="card stat-card">
          <h2 className="card-title">Cadastro</h2>
          <table className="rank admin-dl">
            <tbody>
              <Row label="Nome">{name || "—"}</Row>
              <Row label="E-mail">{user.email}</Row>
              <Row label="Instagram">
                {user.instagram ? (
                  <a href={`https://instagram.com/${user.instagram}`} target="_blank" rel="noopener noreferrer">
                    @{user.instagram} ↗
                  </a>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Cadastro">{formatDateTimeBR(user.created_at)}</Row>
              <Row label="E-mail confirmado">
                {user.email_verified_at ? formatDateTimeBR(user.email_verified_at) : "Não"}
              </Row>
              <Row label="Último login">{sessions.last_login ? formatDateTimeBR(sessions.last_login) : "—"}</Row>
              <Row label="Sessões ativas">{sessions.active}</Row>
              <Row label="ID">
                <code>{user.id}</code>
              </Row>
            </tbody>
          </table>
        </section>

        <section className="card stat-card">
          <h2 className="card-title">Página</h2>
          {profile ? (
            <table className="rank admin-dl">
              <tbody>
                <Row label="Endereço">/{profile.slug}</Row>
                <Row label="Nome exibido">{profile.display_name || "—"}</Row>
                <Row label="Bio">{profile.bio || "—"}</Row>
                <Row label="Criada">{formatDateBR(profile.created_at)}</Row>
                <Row label="Última edição">{formatDateTimeBR(profile.updated_at)}</Row>
                <Row label="Última visita/clique">{stats.last_event ? formatDateTimeBR(stats.last_event) : "—"}</Row>
              </tbody>
            </table>
          ) : (
            <p className="dash-empty">Ainda não criou a página.</p>
          )}
        </section>
      </div>

      <div className="stat-cols">
        <section className="card stat-card">
          <h2 className="card-title">Assinatura</h2>
          {!billingEnabled() && <p className="hint">Cobrança desligada: na prática esta conta tem o Pro.</p>}
          {sub ? (
            <table className="rank admin-dl">
              <tbody>
                <Row label="Plano">
                  <PlanTag plan={plan} />
                </Row>
                <Row label="Status no banco">{sub.status}</Row>
                <Row label="Ciclo">{sub.cycle === "yearly" ? "Anual" : "Mensal"}</Row>
                <Row label="Ativada em">{dateOrDash(sub.activated_at)}</Row>
                <Row label="Período pago até">{dateOrDash(sub.current_period_end)}</Row>
                <Row label="Carência até">{dateOrDash(sub.grace_ends_at)}</Row>
                <Row label="Cancelada em">{dateOrDash(sub.canceled_at)}</Row>
                <Row label="Cortesia até">{dateOrDash(sub.courtesy_until)}</Row>
                <Row label="Cartão">{sub.card_last4 ? `${sub.card_brand ?? ""} •••• ${sub.card_last4}` : "—"}</Row>
                <Row label="Cliente Asaas">
                  <code>{sub.gateway_customer_id ?? "—"}</code>
                </Row>
                <Row label="Assinatura Asaas">
                  <code>{sub.gateway_subscription_id ?? "—"}</code>
                </Row>
                <Row label="Checkouts abertos">{checkouts}</Row>
              </tbody>
            </table>
          ) : (
            <p className="dash-empty">Nunca abriu um checkout: plano Grátis.</p>
          )}
        </section>

        <section className="card stat-card">
          <h2 className="card-title">Pro de cortesia</h2>
          <p className="hint">
            Libera o Pro sem cobrança até o fim do dia escolhido. Se a pessoa assinar, a primeira cobrança só acontece quando
            a cortesia acabar.
          </p>
          <form action={setCourtesy} className="card-form">
            <input type="hidden" name="user_id" value={user.id} />
            <label className="field-label" htmlFor="courtesy-until">
              Válida até
            </label>
            <input
              id="courtesy-until"
              className="field"
              type="date"
              name="until"
              required
              min={courtesy.min}
              defaultValue={courtesy.initial}
            />
            <div className="card-actions">
              <button className="btn btn-primary btn-sm">{courtesy.active ? "Alterar cortesia" : "Dar cortesia"}</button>
            </div>
          </form>
          {courtesy.active && (
            <form action={removeCourtesy}>
              <input type="hidden" name="user_id" value={user.id} />
              <button className="btn btn-outline btn-sm btn-danger">Remover cortesia</button>
            </form>
          )}
        </section>
      </div>

      <section className="card stat-card">
        <h2 className="card-title">Cobranças</h2>
        {invoices.length === 0 ? (
          <p className="dash-empty">Nenhuma cobrança.</p>
        ) : (
          <div className="admin-scroll">
            <table className="rank">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Período até</th>
                  <th>Pago em</th>
                  <th className="num">Valor</th>
                  <th>Situação</th>
                  <th>ID Asaas</th>
                  <th className="num">Links</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{formatDateBR(inv.due_at)}</td>
                    <td>{formatDateBR(inv.period_end)}</td>
                    <td>{dateOrDash(inv.paid_at)}</td>
                    <td className="num">{formatBRL(inv.amount_cents)}</td>
                    <td>
                      <InvoiceTag status={inv.status} />
                    </td>
                    <td>
                      <code>{inv.gateway_payment_id}</code>
                    </td>
                    <td className="num">
                      {inv.invoice_url && (
                        <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                          Fatura
                        </a>
                      )}
                      {inv.invoice_url && inv.receipt_url && " · "}
                      {inv.receipt_url && (
                        <a href={inv.receipt_url} target="_blank" rel="noopener noreferrer">
                          Recibo
                        </a>
                      )}
                      {!inv.invoice_url && !inv.receipt_url && "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stat-card">
        <h2 className="card-title">Links</h2>
        {links.length === 0 ? (
          <p className="dash-empty">Nenhum link.</p>
        ) : (
          <div className="admin-scroll">
            <table className="rank">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Destino</th>
                  <th>Formato</th>
                  <th className="num">Cliques 30d</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className={l.is_active ? "" : "rank-off"}>
                    <td>
                      {l.title}
                      {!l.is_active && <span className="hint"> (oculto)</span>}
                    </td>
                    <td className="admin-url">
                      {l.kind === "whatsapp" ? "WhatsApp" : (
                        <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                          {l.url}
                        </a>
                      )}
                    </td>
                    <td>{l.layout}</td>
                    <td className="num">{l.clicks30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
