import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormBuilder from "@/components/FormBuilder";
import { storedFields } from "@/lib/form-fields";
import { requireUser } from "@/server/auth";
import { formsEnabled, getOwnedForm } from "@/server/forms";
import { getProfileByUser } from "@/server/profiles";

export const metadata: Metadata = { title: "Editar formulário" };

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!(await formsEnabled(user.id))) notFound();
  const { id } = await params;
  const [form, profile] = await Promise.all([getOwnedForm(user.id, id), getProfileByUser(user.id)]);
  if (!form || form.fields === null) notFound();
  const fields = storedFields(form.fields) ?? [];
  return (
    <main className="dash-wide">
      <div className="dash-head">
        <p className="eyebrow"><Link href="/dashboard/formularios">← Formulários</Link></p>
        <h1 className="h2 dash-h1">Editar formulário</h1>
        {profile && form.slug && form.is_published && <p><Link href={`/${profile.slug}/f/${form.slug}`} target="_blank">Abrir formulário publicado ↗</Link></p>}
      </div>
      <FormBuilder id={form.id} name={form.name} title={form.title} slug={form.slug ?? ""} intro={form.intro} thankYou={form.thank_you} isPublished={form.is_published} notifyEmail={form.notify_email} fields={fields} />
    </main>
  );
}
