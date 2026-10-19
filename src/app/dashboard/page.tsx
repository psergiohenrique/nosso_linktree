import Link from "next/link";
import LinkOptions from "@/components/LinkOptions";
import Logo from "@/components/Logo";
import { toPageViewProps } from "@/components/PageView";
import PhonePreview from "@/components/PhonePreview";
import { mediaUrl } from "@/lib/types";
import { SITE_HOST } from "@/lib/site";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import { requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { addLink, createProfile, deleteLink, moveLink, updateLink } from "./actions";

export const dynamic = "force-dynamic";

function splitWhatsapp(url: string) {
  try {
    const u = new URL(url);
    return { phone: u.pathname.replace("/", ""), message: u.searchParams.get("text") ?? "" };
  } catch {
    return { phone: "", message: "" };
  }
}

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: errorMessage } = await searchParams;
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);
  const error = errorMessage && <p className="notice notice-error">{errorMessage}</p>;

  if (!profile) {
    return (
      <main className="auth">
        <Logo />
        <div className="auth-card">
          <h1 className="h2 auth-h1">Crie sua página</h1>
          <p className="auth-text">Escolha o nome do seu negócio e o endereço da sua página.</p>
          {error}
          <form action={createProfile} className="auth-form" data-posthog-event="profile_created">
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
                <span className="slug-prefix">{SITE_HOST}/</span>
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

  const links = await getLinksByProfile(profile.id);
  const plan = await getPlan(user.id);
  const preview = toPageViewProps(profile, links.filter((l) => l.is_active), plan.pro);
  const atLimit = !plan.pro && links.length >= FREE_LINK_LIMIT;

  return (
    <div className="dash-grid">
      <main className="dash-main">
        <div className="dash-head">
          <p className="eyebrow">Links</p>
          <h1 className="h2 dash-h1">Seus links</h1>
        </div>
        {error}

        {!plan.pro && (
          <div className="upsell">
            <p>
              <strong>
                Plano Grátis: {Math.min(links.length, FREE_LINK_LIMIT)} de {FREE_LINK_LIMIT} links.
              </strong>{" "}
              {links.length > FREE_LINK_LIMIT
                ? `Só os ${FREE_LINK_LIMIT} primeiros ativos aparecem na sua página. `
                : ""}
              No Pro: links ilimitados, Destaque e Bloco, e sem o selo.
            </p>
            <Link href="/dashboard/plano" className="btn btn-primary btn-sm">
              Conhecer o Pro
            </Link>
          </div>
        )}

        <form action={addLink} className="card card-new" data-posthog-event="link_created">
          <h2 className="card-title">Novo link</h2>
          <fieldset disabled={atLimit} className="card-fieldset">
            <select name="kind" className="field" defaultValue="link" aria-label="Tipo">
              <option value="link">Link comum</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input
              name="title"
              required
              placeholder="Título (ex.: Agendar horário)"
              aria-label="Título"
              className="field"
            />
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
            <LinkOptions proLayouts={plan.pro} />
            <label className="file-field">
              <span className="field-label">Imagem (opcional; recomendada para Destaque e Bloco)</span>
              <input type="file" name="thumbnail" accept="image/png,image/jpeg,image/webp,image/gif" />
            </label>
            <button className="btn btn-primary">Adicionar</button>
          </fieldset>
          {atLimit && (
            <p className="hint">
              Você chegou ao limite do plano Grátis. <Link href="/dashboard/plano">Assine o Pro</Link> para adicionar
              mais links.
            </p>
          )}
        </form>

        {links.length === 0 && <p className="dash-empty">Nenhum link ainda. Adicione o primeiro acima.</p>}

        {links.map((link, i) => {
          const wa = link.kind === "whatsapp" ? splitWhatsapp(link.url) : null;
          return (
            <div key={link.id} className={`card ${link.is_active ? "" : "card-off"}`}>
              <form action={updateLink} className="card-form" data-posthog-event="link_updated">
                <input type="hidden" name="id" value={link.id} />
                <input type="hidden" name="kind" value={link.kind} />
                <div className="link-head">
                  {link.thumbnail_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(link.thumbnail_id)} alt="" width={48} height={48} className="link-thumb" />
                  ) : (
                    <div className="link-thumb link-thumb-empty" aria-hidden="true">
                      {wa ? "💬" : "🔗"}
                    </div>
                  )}
                  <input name="title" defaultValue={link.title} required aria-label="Título" className="field" />
                </div>
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
                <LinkOptions layout={link.layout} size={link.size} proLayouts={plan.pro} />
                <div className="card-row">
                  <label className="file-field file-field-inline">
                    <span>{link.thumbnail_id ? "Trocar imagem" : "Adicionar imagem"}</span>
                    <input type="file" name="thumbnail" accept="image/png,image/jpeg,image/webp,image/gif" />
                  </label>
                  {link.thumbnail_id && (
                    <label className="check">
                      <input type="checkbox" name="remove_thumbnail" /> Remover imagem
                    </label>
                  )}
                </div>
                <div className="card-row">
                  <label className="check">
                    <input type="checkbox" name="is_active" defaultChecked={link.is_active} /> Ativo
                  </label>
                  <span className={`link-kind ${wa ? "link-kind-whats" : ""}`}>{wa ? "WhatsApp" : "Link"}</span>
                  <button className="btn btn-primary btn-sm">Salvar</button>
                </div>
              </form>
              <div className="card-actions">
                <form action={moveLink} data-posthog-event="link_reordered">
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button className="btn btn-outline btn-sm" aria-label="Subir" disabled={i === 0}>
                    ↑
                  </button>
                </form>
                <form action={moveLink} data-posthog-event="link_reordered">
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button className="btn btn-outline btn-sm" aria-label="Descer" disabled={i === links.length - 1}>
                    ↓
                  </button>
                </form>
                <form action={deleteLink} className="push" data-posthog-event="link_deleted">
                  <input type="hidden" name="id" value={link.id} />
                  <button className="btn btn-outline btn-sm btn-danger">Excluir</button>
                </form>
              </div>
            </div>
          );
        })}
      </main>

      <PhonePreview {...preview} />
    </div>
  );
}
