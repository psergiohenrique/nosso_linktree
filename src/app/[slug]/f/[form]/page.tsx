import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormRunner from "@/components/FormRunner";
import { pageViewStyle } from "@/components/PageView";
import { toPageViewProps } from "@/components/to-page-view";
import { profileTitle } from "@/lib/seo";
import { getPlan } from "@/server/billing";
import { getPublicForm } from "@/server/forms";
import { getPublicPage } from "@/server/profiles";

// Publicar/despublicar no painel vale na hora.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; form: string }> };

async function load(slug: string, formSlug: string) {
  const [form, page] = await Promise.all([
    getPublicForm({ profileSlug: slug, formSlug }),
    getPublicPage(slug),
  ]);
  if (!form || !page) return null;
  return { form, profile: page.profile };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, form: formSlug } = await params;
  const data = await load(slug, formSlug);
  if (!data) return { title: "Formulário não encontrado", robots: { index: false, follow: false } };
  const title = data.form.title || data.form.name;
  return {
    title: `${title} · ${profileTitle(data.profile)}`,
    description: data.form.intro || undefined,
    // Formulário não é conteúdo para a busca; quem chega vem pela página de links.
    robots: { index: false, follow: true },
  };
}

export default async function PublicFormPage({ params }: Params) {
  const { slug, form: formSlug } = await params;
  const data = await load(slug, formSlug);
  if (!data) notFound();

  const { form, profile } = data;
  const plan = await getPlan(profile.id);
  const view = toPageViewProps(profile, [], plan.pro);
  const p = view.profile;
  const name = p.display_name.trim();

  return (
    <main className={`bio bio-font-${p.font} bio-btn-${p.button_style}`} style={pageViewStyle(p)}>
      <div className="bio-inner bf-page">
        <Link href={`/${p.slug}`} className="bf-owner">
          {p.show_avatar &&
            (p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar_url} alt="" width={40} height={40} className="bf-owner-avatar" />
            ) : (
              <span className="bf-owner-avatar bio-initial">{(name || p.slug).charAt(0).toUpperCase()}</span>
            ))}
          <span>{name || `@${p.slug}`}</span>
        </Link>

        <FormRunner
          formId={form.id}
          title={form.title}
          intro={form.intro}
          thankYou={form.thank_you}
          fields={form.fields}
        />

        {view.branding && (
          <Link href="/" className="bio-foot">
            Feito com Linkbio
          </Link>
        )}
      </div>
    </main>
  );
}
