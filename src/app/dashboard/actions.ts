'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeUrl, validAccent, validateSlug, whatsappUrl } from '@/lib/validation';

function fail(message: string): never {
  redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

async function refreshPublicPage(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('slug').eq('id', userId).maybeSingle();
  if (data?.slug) revalidatePath(`/${data.slug}`);
  revalidatePath('/dashboard');
}

export async function createProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const slug = validateSlug(String(formData.get('slug') ?? ''));
  if (!slug) fail('Endereço inválido: use 3 a 30 letras minúsculas, números ou hífen.');

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    slug,
    display_name: String(formData.get('display_name') ?? '').trim().slice(0, 60),
  });
  if (error) fail(error.code === '23505' ? 'Esse endereço já está em uso.' : 'Não foi possível criar a página.');
  revalidatePath('/dashboard');
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const theme = String(formData.get('theme'));
  const avatarRaw = String(formData.get('avatar_url') ?? '').trim();
  const avatar = avatarRaw ? safeUrl(avatarRaw) : null;
  if (avatarRaw && (!avatar || !avatar.startsWith('http'))) fail('URL do avatar inválida.');

  const coverRaw = String(formData.get('cover_url') ?? '').trim();
  const cover = coverRaw ? safeUrl(coverRaw) : null;
  if (coverRaw && (!cover || !cover.startsWith('http'))) fail('URL da capa inválida.');

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: String(formData.get('display_name') ?? '').trim().slice(0, 60),
      bio: String(formData.get('bio') ?? '').trim().slice(0, 200),
      avatar_url: avatar,
      cover_url: cover,
      theme: ['light', 'dark', 'sunset', 'sand'].includes(theme) ? theme : 'light',
      accent: validAccent(String(formData.get('accent') ?? '')),
    })
    .eq('id', user.id);
  if (error) fail('Não foi possível salvar o perfil.');
  await refreshPublicPage(supabase, user.id);
}

function readLink(formData: FormData) {
  const kind = formData.get('kind') === 'whatsapp' ? 'whatsapp' : 'link';
  const title = String(formData.get('title') ?? '').trim().slice(0, 80);
  if (!title) fail('Dê um título ao link.');

  const rawTarget = String(formData.get('url') ?? '');
  const url =
    kind === 'whatsapp' ? whatsappUrl(rawTarget, String(formData.get('message') ?? '')) : safeUrl(rawTarget);
  if (!url) fail(kind === 'whatsapp' ? 'Número de WhatsApp inválido.' : 'URL inválida.');

  return { kind, title, url } as const;
}

export async function addLink(formData: FormData) {
  const { supabase, user } = await requireUser();
  const link = readLink(formData);

  const { data: last } = await supabase
    .from('links')
    .select('position')
    .eq('profile_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('links')
    .insert({ ...link, profile_id: user.id, position: (last?.position ?? -1) + 1 });
  if (error) fail('Não foi possível adicionar o link.');
  await refreshPublicPage(supabase, user.id);
}

export async function updateLink(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get('id'));
  const link = readLink(formData);

  const { error } = await supabase
    .from('links')
    .update({ ...link, is_active: formData.get('is_active') === 'on' })
    .eq('id', id)
    .eq('profile_id', user.id);
  if (error) fail('Não foi possível salvar o link.');
  await refreshPublicPage(supabase, user.id);
}

export async function deleteLink(formData: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('links').delete().eq('id', String(formData.get('id'))).eq('profile_id', user.id);
  await refreshPublicPage(supabase, user.id);
}

export async function moveLink(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get('id'));
  const dir = formData.get('dir') === 'up' ? -1 : 1;

  const { data: links } = await supabase
    .from('links')
    .select('id, position')
    .eq('profile_id', user.id)
    .order('position');
  if (!links) return;

  const index = links.findIndex((l) => l.id === id);
  const other = links[index + dir];
  if (index < 0 || !other) return;

  // Renumera toda a lista para evitar posições duplicadas.
  const reordered = [...links];
  [reordered[index], reordered[index + dir]] = [reordered[index + dir], reordered[index]];
  await Promise.all(
    reordered.map((l, i) => supabase.from('links').update({ position: i }).eq('id', l.id).eq('profile_id', user.id)),
  );
  await refreshPublicPage(supabase, user.id);
}

export async function signOut() {
  await (await createClient()).auth.signOut();
  redirect('/login');
}
