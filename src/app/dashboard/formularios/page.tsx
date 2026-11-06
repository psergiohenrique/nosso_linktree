import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { formsEnabled, listForms, listResponses, responseCounts, RESPONSES_PAGE_SIZE } from "@/server/forms";
import { addFormLink, createForm, removeForm } from "./actions";
import { getProfileByUser } from "@/server/profiles";
import { followUpMessage, formatDateTimeBR, progressLabel, type FormResponseStatus } from "@/lib/forms";
import { pct } from "@/lib/metrics";
import { whatsappUrl } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Formulários" };

const FILTERS: { key: string; label: string; status?: FormResponseStatus }[] = [
  { key: "todas", label: "Todas" },
  { key: "incompletas", label: "Incompletas", status: "partial" },
  { key: "completas", label: "Completas", status: "complete" },
];

const UUID = /^[0-9a-f-]{36}$/i;

export default async function FormulariosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; form?: string; pagina?: string; excluida?: string; error?: string; formExcluido?: string; linkAdicionado?: string }>;
}) {
  const user = await requireUser();
  const { filtro, form: rawForm, pagina, excluida, error, formExcluido, linkAdicionado } = await searchParams;
  if (!(await formsEnabled(user.id))) notFound();
  const [forms, profile] = await Promise.all([listForms(user.id), getProfileByUser(user.id)]);

  const filter = FILTERS.find((f) => f.key === filtro) ?? FILTERS[0];
  const formId = rawForm && UUID.test(rawForm) && forms.some((f) => f.id === rawForm) ? rawForm : undefined;
  const page = Math.max(1, Math.floor(Number(pagina)) || 1);

  const [counts, { rows, total }] = await Promise.all([
    responseCounts(user.id, formId),
    listResponses(user.id, { formId, status: filter.status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));

  const href = (changes: { filtro?: string; form?: string | null; pagina?: number }) => {
    const params = new URLSearchParams();
    const f = changes.filtro ?? filter.key;
    if (f !== "todas") params.set("filtro", f);
    const fid = changes.form === undefined ? formId : changes.form;
    if (fid) params.set("form", fid);
    if (changes.pagina && changes.pagina > 1) params.set("pagina", String(changes.pagina));
    const qs = params.toString();
    return `/dashboard/formularios${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="dash-wide forms-dashboard">
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">Formulários</p>
          <h1 className="h2 dash-h1">Seus formulários</h1>
          <p className="hint">
            Crie formulários, publique na sua página e acompanhe as respostas.
          </p>
        </div>
      </div>

      <section className="card stat-card">
        <div className="form-card-head">
          <h2 className="card-title">Gerenciar formulários</h2>
          <form action={createForm}><button className="btn btn-primary btn-sm">Criar formulário</button></form>
        </div>
        {forms.length === 0 ? <p className="dash-empty">Você ainda não tem formulários.</p> : (
          <div className="admin-scroll"><table className="rank"><thead><tr><th>Nome</th><th>Situação</th><th>Gerenciar</th></tr></thead><tbody>
            {forms.map((f) => <tr key={f.id}>
              <td>{f.name}</td>
              <td>{f.fields === null ? "Externo" : f.is_published ? "Publicado" : "Rascunho"}</td>
              <td>{f.fields !== null && (
                <div className="form-manage-actions">
                  <div className="dash-head-actions">
                    <Link className="btn btn-outline btn-sm" href={`/dashboard/formularios/editar/${f.id}`}>Editar</Link>
                    {f.is_published && f.slug && profile && <Link className="btn btn-outline btn-sm" href={`/${profile.slug}/f/${f.slug}`} target="_blank" rel="noopener noreferrer">Abrir ↗</Link>}
                  </div>
                  {f.is_published && f.slug && profile && (
                    <form action={addFormLink}><input type="hidden" name="id" value={f.id} /><button className="btn btn-outline btn-sm">Adicionar à página de links</button></form>
                  )}
                  <details className="form-delete">
                    <summary>Excluir formulário</summary>
                    <form action={removeForm} className="form-delete-confirm">
                      <input type="hidden" name="id" value={f.id} />
                      <p>Esta ação é irreversível e exclui todas as respostas. Links na sua página precisam ser removidos manualmente.</p>
                      <label className="check"><input type="checkbox" name="confirm" required /> Confirmo a exclusão do formulário e de todas as respostas.</label>
                      <div className="dash-head-actions"><button className="btn btn-outline btn-sm">Excluir definitivamente</button></div>
                    </form>
                  </details>
                </div>
              )}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>

      {error && <p className="notice" role="alert">{error}</p>}
      {formExcluido && <p className="notice notice-ok">Formulário e respostas excluídos.</p>}
      {linkAdicionado && <p className="notice notice-ok">Formulário adicionado à página de links. Você pode editar ou remover o link na aba Links.</p>}
      {excluida && <p className="notice notice-ok">Resposta excluída.</p>}

      <header className="form-section-head">
        <div className="form-card-head">
          <h2 className="card-title">Respostas</h2>
          <nav className="range" aria-label="Filtrar respostas">
            {FILTERS.map((f) => (
              <Link key={f.key} href={href({ filtro: f.key, pagina: 1 })} className={f.key === filter.key ? "active" : ""}>
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="hint">As respostas são salvas a cada etapa. Quem não terminou aparece como incompleta, com o que já respondeu.</p>
      </header>

      {forms.length > 1 && (
        <nav className="range form-picker" aria-label="Formulário">
          <Link href={href({ form: null, pagina: 1 })} className={!formId ? "active" : ""}>
            Todos
          </Link>
          {forms.map((f) => (
            <Link key={f.id} href={href({ form: f.id, pagina: 1 })} className={formId === f.id ? "active" : ""}>
              {f.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-num">{counts.total}</div>
          <div className="kpi-label">Começaram</div>
        </div>
        <div className="kpi kpi-whats">
          <div className="kpi-num">{counts.complete}</div>
          <div className="kpi-label">Enviaram</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{counts.partial}</div>
          <div className="kpi-label">Pararam no meio</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{pct(counts.complete, counts.total)}</div>
          <div className="kpi-label">Taxa de envio</div>
        </div>
      </div>

      <section className="card stat-card">
        {rows.length === 0 ? (
          <p className="dash-empty">
            {counts.total === 0 ? "Ainda não chegou nenhuma resposta." : "Nenhuma resposta neste filtro."}
          </p>
        ) : (
          <div className="admin-scroll">
            <table className="rank form-responses">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Nome</th>
                  <th>Situação</th>
                  {forms.length > 1 && !formId && <th>Formulário</th>}
                  <th className="num">Contato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const wa = r.contact_phone ? whatsappUrl(r.contact_phone, followUpMessage(r.status, r.contact_name)) : null;
                  return (
                    <tr key={r.id}>
                      <td>{formatDateTimeBR(r.updated_at)}</td>
                      <td>
                        <Link href={`/dashboard/formularios/${r.id}`}>{r.contact_name || "Sem nome"}</Link>
                      </td>
                      <td>
                        {r.status === "complete" ? (
                          <span className="form-tag form-tag-ok">Enviou</span>
                        ) : (
                          <span className="form-tag form-tag-warn">
                            Parou na {progressLabel(r.step, r.total_steps)}
                          </span>
                        )}
                      </td>
                      {forms.length > 1 && !formId && <td>{r.form_name}</td>}
                      <td className="num">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whats btn-sm">
                            WhatsApp
                          </a>
                        ) : (
                          <span className="hint">sem telefone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="admin-pager">
            {page > 1 ? <Link href={href({ pagina: page - 1 })}>← Anteriores</Link> : <span />}
            <span className="hint">
              Página {page} de {pages}
            </span>
            {page < pages ? <Link href={href({ pagina: page + 1 })}>Próximas →</Link> : <span />}
          </div>
        )}
      </section>
    </main>
  );
}
