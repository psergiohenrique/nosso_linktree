import type { Metadata } from "next";
import Link from "next/link";
import { formatBRL, formatDateBR } from "@/lib/billing";
import { ACCOUNTS_PAGE_SIZE, listAccounts, requireAdmin } from "@/server/admin";
import { PlanTag } from "../format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Contas" };

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  await requireAdmin();
  const { q = "", pagina } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pagina)) || 1);
  const { total, accounts } = await listAccounts({ search: q, page });
  const pages = Math.max(1, Math.ceil(total / ACCOUNTS_PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("pagina", String(p));
    const s = params.toString();
    return `/admin/contas${s ? `?${s}` : ""}`;
  };

  return (
    <main className="dash-wide admin">
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h2 dash-h1">Contas</h1>
        </div>
        <form className="admin-search" action="/admin/contas">
          <input
            aria-label="Buscar contas"
            className="field"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="E-mail, nome, Instagram ou endereço"
          />
          <button className="btn btn-primary btn-sm">Buscar</button>
        </form>
      </div>

      <p className="hint">
        {total} {total === 1 ? "conta" : "contas"}
        {q && ` para “${q}”`}
        {q && (
          <>
            {" · "}
            <Link href="/admin/contas">limpar busca</Link>
          </>
        )}
      </p>

      <section className="card stat-card">
        {accounts.length === 0 ? (
          <p className="dash-empty">Nenhuma conta encontrada.</p>
        ) : (
          <div className="admin-scroll">
            <table className="rank">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Página</th>
                  <th>Cadastro</th>
                  <th>Plano</th>
                  <th className="num">Links</th>
                  <th className="num">Visitas 30d</th>
                  <th className="num">Total pago</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/contas/${a.id}`}>{a.name || a.email}</Link>
                      <div className="hint">
                        {a.name && a.email}
                        {a.instagram && ` · @${a.instagram}`}
                        {!a.verified && <span className="admin-tag admin-tag-warn">não confirmado</span>}
                      </div>
                    </td>
                    <td>
                      {a.slug ? (
                        <a href={`/${a.slug}`} target="_blank" rel="noopener noreferrer">
                          /{a.slug} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDateBR(a.created_at)}</td>
                    <td>
                      <PlanTag plan={a.plan} />
                    </td>
                    <td className="num">{a.links}</td>
                    <td className="num">{a.views30}</td>
                    <td className="num">{a.paid_cents ? formatBRL(a.paid_cents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pages > 1 && (
        <nav className="admin-pager" aria-label="Páginas">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn btn-outline btn-sm">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="hint">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="btn btn-outline btn-sm">
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
