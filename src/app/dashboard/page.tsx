import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import type { LinkItem, Profile } from "@/lib/types";
import { addLink, createProfile, deleteLink, moveLink, signOut, updateLink, updateProfile } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

function splitWhatsapp(url: string) {
  try {
    const u = new URL(url);
    return { phone: u.pathname.replace("/", ""), message: u.searchParams.get("text") ?? "" };
  } catch {
    return { phone: "", message: "" };
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; days?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  const error = params.error && <p className="notice notice-error">{params.error}</p>;

  if (!profile) {
    return (
      <main className="auth">
        <Logo />
        <div className="auth-card">
          <h1 className="h2 auth-h1">Crie sua página</h1>
          <p className="auth-text">Escolha o nome do seu negócio e o endereço da sua página.</p>
          {error}
          <form action={createProfile} className="auth-form">
            <div>
              <label className="field-label" htmlFor="display_name">
                Nome
              </label>
              <input id="display_name" name="display_name" placeholder="Ex.: Barbearia do Zé" className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="slug">
                Endereço
              </label>
              <div className="slug-row">
                <span className="slug-prefix">linkbio/</span>
                <input
                  id="slug"
                  name="slug"
                  required
                  placeholder="meu-negocio"
                  pattern="[a-z0-9\-]{3,30}"
                  className="field"
                />
              </div>
            </div>
            <button className="btn btn-primary">Criar página</button>
          </form>
        </div>
      </main>
    );
  }

  const days = params.days === "30" ? 30 : 7;
  const [{ data: links }, { data: perLink }, { data: totals }] = await Promise.all([
    supabase.from("links").select("*").eq("profile_id", user.id).order("position").returns<LinkItem[]>(),
    supabase.rpc("profile_stats", { p_days: days }),
    supabase.rpc("profile_totals", { p_days: days }),
  ]);

  const clicksById = new Map<string, number>(
    (perLink ?? []).map((r: { link_id: string; clicks: number }) => [r.link_id, Number(r.clicks)] as [string, number]),
  );
  const views = Number(totals?.[0]?.views ?? 0);
  const clicks = Number(totals?.[0]?.clicks ?? 0);
  const ctr = views > 0 ? Math.round((clicks / views) * 100) : 0;

  return (
    <main className="dash">
      <header className="dash-top">
        <Logo />
        <form action={signOut}>
          <button className="btn btn-outline btn-sm">Sair</button>
        </form>
      </header>

      <div className="dash-head">
        <div>
          <p className="eyebrow">Painel</p>
          <h1 className="h2 dash-h1">{profile.display_name || `@${profile.slug}`}</h1>
          <Link href={`/${profile.slug}`} target="_blank" className="dash-page-link">
            Ver minha página: /{profile.slug} ↗
          </Link>
        </div>
      </div>

      {error}

      <section className="dash-section">
        <div className="dash-section-head">
          <h2 className="h2 dash-h2">Resultados</h2>
          <div className="range">
            <Link href="/dashboard?days=7" className={days === 7 ? "active" : ""}>
              7 dias
            </Link>
            <Link href="/dashboard?days=30" className={days === 30 ? "active" : ""}>
              30 dias
            </Link>
          </div>
        </div>
        <div className="kpis">
          {[
            ["Visualizações", views],
            ["Cliques", clicks],
            ["Taxa de clique", `${ctr}%`],
          ].map(([label, value]) => (
            <div key={label} className="kpi">
              <div className="kpi-num">{value}</div>
              <div className="kpi-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-section">
        <h2 className="h2 dash-h2">Links</h2>

        {(links ?? []).map((link) => {
          const wa = link.kind === "whatsapp" ? splitWhatsapp(link.url) : null;
          return (
            <div key={link.id} className="card">
              <span className={`link-kind ${wa ? "link-kind-whats" : ""}`}>{wa ? "WhatsApp" : "Link"}</span>
              <form action={updateLink} className="card-form">
                <input type="hidden" name="id" value={link.id} />
                <input type="hidden" name="kind" value={link.kind} />
                <input name="title" defaultValue={link.title} required aria-label="Título" className="field" />
                <input
                  name="url"
                  defaultValue={wa ? wa.phone : link.url}
                  placeholder={wa ? "WhatsApp com DDD" : "https://..."}
                  required
                  aria-label={wa ? "WhatsApp" : "URL"}
                  className="field"
                />
                {wa && (
                  <input
                    name="message"
                    defaultValue={wa.message}
                    placeholder="Mensagem inicial"
                    aria-label="Mensagem inicial"
                    className="field"
                  />
                )}
                <div className="card-row">
                  <label className="check">
                    <input type="checkbox" name="is_active" defaultChecked={link.is_active} /> Ativo
                  </label>
                  <span className="clicks">
                    {clicksById.get(link.id) ?? 0} cliques ({days}d)
                  </span>
                  <button className="btn btn-primary btn-sm">Salvar</button>
                </div>
              </form>
              <div className="card-actions">
                <form action={moveLink}>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button className="btn btn-outline btn-sm" aria-label="Subir">
                    ↑
                  </button>
                </form>
                <form action={moveLink}>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button className="btn btn-outline btn-sm" aria-label="Descer">
                    ↓
                  </button>
                </form>
                <form action={deleteLink} className="push">
                  <input type="hidden" name="id" value={link.id} />
                  <button className="btn btn-outline btn-sm btn-danger">Excluir</button>
                </form>
              </div>
            </div>
          );
        })}

        <form action={addLink} className="card card-new">
          <h3 className="card-title">Novo link</h3>
          <select name="kind" className="field" defaultValue="link" aria-label="Tipo">
            <option value="link">Link comum</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <input
            name="title"
            required
            list="sugestoes-titulo"
            placeholder="Título: digite ou escolha uma sugestão"
            aria-label="Título"
            className="field"
          />
          <datalist id="sugestoes-titulo">
            <option value="Solicitar orçamento" />
            <option value="Agendar uma conversa" />
            <option value="Contratar palestra ou evento corporativo" />
            <option value="Cursos e protocolos" />
            <option value="Baixar material gratuito" />
            <option value="Ver portfólio completo" />
            <option value="Projetos recentes" />
            <option value="Agendar visita técnica" />
            <option value="Tabela de preços" />
            <option value="Catálogo completo" />
            <option value="Cardápio" />
            <option value="Como chegar" />
            <option value="Instagram" />
            <option value="YouTube" />
            <option value="TikTok" />
            <option value="Pinterest" />
          </datalist>
          <input
            name="url"
            required
            placeholder="URL, ou número de WhatsApp com DDD"
            aria-label="URL ou WhatsApp"
            className="field"
          />
          <input
            name="message"
            placeholder="Mensagem inicial (só para WhatsApp)"
            aria-label="Mensagem inicial"
            className="field"
          />
          <button className="btn btn-primary">Adicionar</button>
        </form>
      </section>

      <section className="dash-section">
        <h2 className="h2 dash-h2">Aparência</h2>
        <form action={updateProfile} className="card">
          <input name="display_name" defaultValue={profile.display_name} placeholder="Nome" aria-label="Nome" className="field" />
          <textarea
            name="bio"
            defaultValue={profile.bio}
            placeholder="Bio"
            aria-label="Bio"
            rows={2}
            maxLength={200}
            className="field"
          />
          <input
            name="avatar_url"
            defaultValue={profile.avatar_url ?? ""}
            placeholder="URL da foto (opcional)"
            aria-label="URL da foto"
            className="field"
          />
          <input
            name="cover_url"
            defaultValue={profile.cover_url ?? ""}
            placeholder="URL da imagem de capa (opcional)"
            aria-label="URL da imagem de capa"
            className="field"
          />
          <div className="inline-row">
            <select name="theme" defaultValue={profile.theme} aria-label="Tema" className="field">
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
              <option value="sunset">Pôr do sol</option>
              <option value="sand">Areia (bege, serifa)</option>
            </select>
            <input type="color" name="accent" defaultValue={profile.accent} className="field-color" aria-label="Cor de destaque" />
          </div>
          <button className="btn btn-primary">Salvar aparência</button>
        </form>
      </section>
    </main>
  );
}
