import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { listForms, listResponses, responseCounts, RESPONSES_PAGE_SIZE } from "@/server/forms";
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
  searchParams: Promise<{ filtro?: string; form?: string; pagina?: string; excluida?: string }>;
}) {
  const user = await requireUser();
  const { filtro, form: rawForm, pagina, excluida } = await searchParams;
  const forms = await listForms(user.id);
  if (forms.length === 0) notFound();

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
    <main className="dash-wide">
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">Formulários</p>
          <h1 className="h2 dash-h1">Quem respondeu</h1>
          <p className="hint">
            As respostas chegam a cada etapa: quem parou no meio aparece como incompleta, com o que já respondeu.
          </p>
        </div>
        <nav className="range" aria-label="Filtrar respostas">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href({ filtro: f.key, pagina: 1 })} className={f.key === filter.key ? "active" : ""}>
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {excluida && <p className="notice notice-ok">Resposta excluída.</p>}

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
