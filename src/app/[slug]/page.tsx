import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageView from '@/components/PageView';
import ViewTracker from '@/components/ViewTracker';
import { createPublicClient } from '@/lib/supabase/public';

// Página pública em cache; o painel chama revalidatePath ao salvar.
export const revalidate = 60;

// Lista vazia: nenhuma página no build, cada slug entra no cache (ISR) na primeira visita.
export async function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  const supabase = createPublicClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, slug, display_name, bio, avatar_url, theme, accent')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (!profile) return null;

  const { data: links } = await supabase
    .from('links')
    .select('id, title, url, kind')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('position');

  return { profile, links: links ?? [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: 'Página não encontrada' };
  const name = data.profile.display_name || `@${data.profile.slug}`;
  return {
    title: name,
    description: data.profile.bio || `Links de ${name}`,
    alternates: { canonical: `/${data.profile.slug}` },
  };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug);
  if (!data) notFound();

  return (
    <>
      <PageView profile={data.profile} links={data.links} />
      <ViewTracker profileId={data.profile.id} />
    </>
  );
}
