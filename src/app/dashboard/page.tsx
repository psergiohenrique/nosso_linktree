import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { LinkItem, Profile } from '@/lib/types';
import { addLink, createProfile, deleteLink, moveLink, signOut, updateLink, updateProfile } from './actions';

export const dynamic = 'force-dynamic';

const input = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm';
const btn = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white';
const btnGhost = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm';

function splitWhatsapp(url: string) {
  try {
    const u = new URL(url);
    return { phone: u.pathname.replace('/', ''), message: u.searchParams.get('text') ?? '' };
  } catch {
    return { phone: '', message: '' };
  }
}

export default async function Dashboard({ searchParams }: { searchParams: { error?: string; days?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  const error = searchParams.error && (
    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
  );

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Crie sua página</h1>
        {error}
        <form action={createProfile} className="flex flex-col gap-3">
          <input name="display_name" placeholder="Nome (ex.: Barbearia do Zé)" className={input} />
          <div className="flex items-center gap-1 text-sm">
            <span className="text-neutral-500">linkbio/</span>
            <input name="slug" required placeholder="meu-negocio" pattern="[a-z0-9\-]{3,30}" className={input} />
          </div>
          <button className={btn}>Criar página</button>
        </form>
      </main>
    );
  }

  const days = searchParams.days === '30' ? 30 : 7;
  const [{ data: links }, { data: perLink }, { data: totals }] = await Promise.all([
    supabase.from('links').select('*').eq('profile_id', user.id).order('position').returns<LinkItem[]>(),
    supabase.rpc('profile_stats', { p_days: days }),
    supabase.rpc('profile_totals', { p_days: days }),
  ]);

  const clicksById = new Map<string, number>(
    (perLink ?? []).map((r: { link_id: string; clicks: number }) => [r.link_id, Number(r.clicks)] as [string, number]),
  );
  const views = Number(totals?.[0]?.views ?? 0);
  const clicks = Number(totals?.[0]?.clicks ?? 0);
  const ctr = views > 0 ? Math.round((clicks / views) * 100) : 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Painel</h1>
          <Link href={`/${profile.slug}`} target="_blank" className="text-sm text-indigo-600">
            Ver minha página: /{profile.slug}
          </Link>
        </div>
        <form action={signOut}>
          <button className={btnGhost}>Sair</button>
        </form>
      </header>

      {error}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Resultados</h2>
          <div className="flex gap-2 text-sm">
            <Link href="/dashboard?days=7" className={days === 7 ? 'font-bold' : 'text-neutral-500'}>7 dias</Link>
            <Link href="/dashboard?days=30" className={days === 30 ? 'font-bold' : 'text-neutral-500'}>30 dias</Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ['Visualizações', views],
            ['Cliques', clicks],
            ['Taxa de clique', `${ctr}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Links</h2>

        {(links ?? []).map((link) => {
          const wa = link.kind === 'whatsapp' ? splitWhatsapp(link.url) : null;
          return (
            <div key={link.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
              <form action={updateLink} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={link.id} />
                <input type="hidden" name="kind" value={link.kind} />
                <input name="title" defaultValue={link.title} required className={input} />
                <input
                  name="url"
                  defaultValue={wa ? wa.phone : link.url}
                  placeholder={wa ? 'WhatsApp com DDD' : 'https://...'}
                  required
                  className={input}
                />
                {wa && <input name="message" defaultValue={wa.message} placeholder="Mensagem inicial" className={input} />}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_active" defaultChecked={link.is_active} /> Ativo
                  </label>
                  <span className="text-neutral-500">{clicksById.get(link.id) ?? 0} cliques ({days}d)</span>
                  <button className={btn}>Salvar</button>
                </div>
              </form>
              <div className="flex gap-2">
                <form action={moveLink}>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button className={btnGhost} aria-label="Subir">↑</button>
                </form>
                <form action={moveLink}>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button className={btnGhost} aria-label="Descer">↓</button>
                </form>
                <form action={deleteLink} className="ml-auto">
                  <input type="hidden" name="id" value={link.id} />
                  <button className={`${btnGhost} text-red-600`}>Excluir</button>
                </form>
              </div>
            </div>
          );
        })}

        <form action={addLink} className="flex flex-col gap-2 rounded-xl border border-dashed border-neutral-300 p-4">
          <h3 className="text-sm font-medium">Novo link</h3>
          <select name="kind" className={input} defaultValue="link">
            <option value="link">Link comum</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <input name="title" required placeholder="Título (ex.: Agendar horário)" className={input} />
          <input name="url" required placeholder="URL, ou número de WhatsApp com DDD" className={input} />
          <input name="message" placeholder="Mensagem inicial (só para WhatsApp)" className={input} />
          <button className={btn}>Adicionar</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Aparência</h2>
        <form action={updateProfile} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
          <input name="display_name" defaultValue={profile.display_name} placeholder="Nome" className={input} />
          <textarea name="bio" defaultValue={profile.bio} placeholder="Bio" rows={2} maxLength={200} className={input} />
          <input name="avatar_url" defaultValue={profile.avatar_url ?? ''} placeholder="URL da foto (opcional)" className={input} />
          <div className="flex gap-2">
            <select name="theme" defaultValue={profile.theme} className={input}>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
              <option value="sunset">Pôr do sol</option>
            </select>
            <input type="color" name="accent" defaultValue={profile.accent} className="h-10 w-16 rounded-lg border border-neutral-300" aria-label="Cor de destaque" />
          </div>
          <button className={btn}>Salvar aparência</button>
        </form>
      </section>
    </main>
  );
}
