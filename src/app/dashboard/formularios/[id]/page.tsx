import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteLinkButton from "@/components/DeleteLinkButton";
import { deleteFormResponse } from "@/app/dashboard/actions";
import { requireUser } from "@/server/auth";
import { getResponse } from "@/server/forms";
import { followUpMessage, formatDateTimeBR, progressLabel } from "@/lib/forms";
import { whatsappUrl } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resposta" };

export default async function FormResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await getResponse(user.id, id);
  if (!r) notFound();

  const wa = r.contact_phone ? whatsappUrl(r.contact_phone, followUpMessage(r.status, r.contact_name)) : null;
  const complete = r.status === "complete";

  return (
    <main className="dash-wide">
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/formularios">← Formulários</Link>
          </p>
          <h1 className="h2 dash-h1">{r.contact_name || "Sem nome"}</h1>
          <p className="hint">
            {r.form_name} ·{" "}
            {complete ? (
              <span className="form-tag form-tag-ok">Enviou</span>
            ) : (
              <span className="form-tag form-tag-warn">Parou na {progressLabel(r.step, r.total_steps)}</span>
            )}
          </p>
        </div>
        <div className="dash-head-actions">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whats btn-sm">
              {complete ? "Chamar no WhatsApp" : "Retomar no WhatsApp"}
            </a>
          )}
          <DeleteLinkButton
            id={r.id}
            title={r.contact_name || "esta resposta"}
            action={deleteFormResponse}
            heading="Excluir resposta?"
            posthogEvent="form_response_deleted"
          />
        </div>
      </div>

      <section className="card stat-card">
        <h2 className="card-title">Respostas</h2>
        {r.answers.length === 0 ? (
          <p className="dash-empty">Nada respondido ainda.</p>
        ) : (
          <dl className="form-answers">
            {r.answers.map((a) => (
              <div key={a.id}>
                <dt>{a.label}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="card stat-card">
        <h2 className="card-title">Detalhes</h2>
        <table className="rank admin-dl">
          <tbody>
            <tr>
              <th scope="row">Começou</th>
              <td>{formatDateTimeBR(r.created_at)}</td>
            </tr>
            <tr>
              <th scope="row">{complete ? "Enviou" : "Última resposta"}</th>
              <td>{formatDateTimeBR(r.completed_at ?? r.updated_at)}</td>
            </tr>
            {r.page_url && (
              <tr>
                <th scope="row">Página</th>
                <td className="admin-url">{r.page_url}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
