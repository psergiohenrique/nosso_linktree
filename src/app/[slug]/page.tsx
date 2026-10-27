import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PageView, { toPageViewProps } from "@/components/PageView";
import ViewTracker from "@/components/ViewTracker";
import { applyPlanToLinks } from "@/lib/billing";
import {
  isIndexable,
  jsonLdString,
  profileDescription,
  profileJsonLd,
  profileTitle,
  socialMetadata,
} from "@/lib/seo";
import { mediaUrl } from "@/lib/types";
import { getPlan } from "@/server/billing";
import { getPublicPage } from "@/server/profiles";

// Página pública em cache; o painel chama revalidatePath ao salvar.
export const revalidate = 60;

// Lista vazia: nenhuma página no build, cada slug entra no cache (ISR) na primeira visita.
export async function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ slug: string }> };

/** Perfil, links que a página mostra (já com o plano aplicado) e plano. */
async function load(slug: string) {
  const data = await getPublicPage(slug);
  if (!data) return null;
  const plan = await getPlan(data.profile.id);
  return { ...data, plan, visible: applyPlanToLinks(data.links, plan.pro) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Página não encontrada", robots: { index: false, follow: false } };

  const { profile, visible } = data;
  const title = profileTitle(profile);
  const description = profileDescription(profile, visible.map((l) => l.title));
  const path = `/${profile.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    // Sem conteúdo mínimo (ou com a opção desligada): fora da busca, mas os links continuam rastreáveis.
    ...(!isIndexable(profile, visible.length) && { robots: { index: false, follow: true } }),
    ...socialMetadata({ title, description, path, type: "profile" }),
  };
}

export default async function PublicPage({ params }: Params) {
  const { slug } = await params;
  // /Foo e /foo são a mesma página: um só endereço para o Google.
  if (slug !== slug.toLowerCase()) permanentRedirect(`/${slug.toLowerCase()}`);

  const data = await load(slug);
  if (!data) notFound();
  const { profile, links, plan, visible } = data;

  const jsonLd = profileJsonLd(profile, {
    avatarUrl: profile.avatar_id ? mediaUrl(profile.avatar_id) : null,
    linkUrls: visible.filter((l) => l.kind === "link").map((l) => l.url),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <PageView {...toPageViewProps(profile, links, plan.pro)} />
      <ViewTracker profileId={data.profile.id} />
    </>
  );
}
