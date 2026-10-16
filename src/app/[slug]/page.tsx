import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageView, { toPageViewProps } from "@/components/PageView";
import ViewTracker from "@/components/ViewTracker";
import { mediaUrl } from "@/lib/types";
import { getPublicPage } from "@/server/profiles";

// Página pública em cache; o painel chama revalidatePath ao salvar.
export const revalidate = 60;

// Lista vazia: nenhuma página no build, cada slug entra no cache (ISR) na primeira visita.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getPublicPage((await params).slug);
  if (!data) return { title: "Página não encontrada" };
  const name = data.profile.display_name || `@${data.profile.slug}`;
  return {
    title: name,
    description: data.profile.bio || `Links de ${name}`,
    alternates: { canonical: `/${data.profile.slug}` },
    openGraph: data.profile.avatar_id ? { images: [mediaUrl(data.profile.avatar_id)] } : undefined,
  };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getPublicPage((await params).slug);
  if (!data) notFound();

  return (
    <>
      <PageView {...toPageViewProps(data.profile, data.links)} />
      <ViewTracker profileId={data.profile.id} />
    </>
  );
}
