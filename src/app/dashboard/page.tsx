import Link from "next/link";
import AddLinkButton from "@/components/AddLinkButton";
import DeleteLinkButton from "@/components/DeleteLinkButton";
import ImageInput from "@/components/ImageInput";
import LinkOptions from "@/components/LinkOptions";
import Logo from "@/components/Logo";
import { toPageViewProps } from "@/components/PageView";
import { PaywallButton } from "@/components/Paywall";
import PhonePreview from "@/components/PhonePreview";
import ProfileQRCode from "@/components/ProfileQRCode";
import SignupSteps from "@/components/SignupSteps";
import { mediaUrl } from "@/lib/types";
import { SITE_HOST } from "@/lib/site";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import { isIndexable } from "@/lib/seo";
import { getUserName, requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { addLink, createProfile, deleteLink, moveLink, toggleSearchIndexing, updateLink } from "./actions";

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
          <SignupSteps current={3} />
          <h1 className="h2 auth-h1">Crie sua página</h1>
          <p className="auth-text">Escolha o nome do seu negócio e o endereço da sua página.</p>
          {error}
          <form action={createProfile} className="auth-form" data-posthog-event="profile_created">
            <div>
              <label className="field-label" htmlFor="display_name">
                Nome
              </label>
              <input
                id="display_name"
                name="display_name"
                maxLength={60}
                defaultValue={(await getUserName(user.id)).slice(0, 60)}
                placeholder="Ex.: Barbearia do Zé"
                className="field"
              />
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
  const indexed = isIndexable(profile, preview.links.length);

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
          <fieldset className="card-fieldset">
            <div>
              <label className="field-label" htmlFor="new-kind">
                Tipo
              </label>
              <select id="new-kind" name="kind" className="field" defaultValue="link">
                <option value="link">Link comum</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="new-title">
                Título
              </label>
              <input id="new-title" name="title" required placeholder="Ex.: Agendar horário" className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="new-url">
                Link ou WhatsApp com DDD
              </label>
              <input
                id="new-url"
                name="url"
                required
                placeholder="https://… ou 11 99999-9999"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-message">
                Mensagem inicial <span className="field-optional">(só WhatsApp, opcional)</span>
              </label>
              <input id="new-message" name="message" placeholder="Ex.: Quero agendar" className="field" />
            </div>
            <LinkOptions proLayouts={plan.pro} />
            <label className="file-field">
              <span className="field-label">
                Imagem <span className="field-optional">(opcional; boa para Destaque e Bloco)</span>
              </span>
              <ImageInput name="thumbnail" />
            </label>
            {/* No limite do Grátis o formulário continua aberto; o botão mostra o aviso do Pro. */}
            {atLimit ? (
              <PaywallButton feature="links" className="btn btn-primary">
                Adicionar
              </PaywallButton>
            ) : (
              <AddLinkButton />
            )}
          </fieldset>
          {atLimit && (
            <p className="hint">
              Você chegou aos {FREE_LINK_LIMIT} links do plano Grátis. Com o Pro, são ilimitados.
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
                    <ImageInput name="thumbnail" />
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
                <DeleteLinkButton id={link.id} title={link.title} action={deleteLink} />
              </div>
            </div>
          );
        })}

        <ProfileQRCode slug={profile.slug} />

        <section className="card weekly-card">
          <div>
            <h2 className="card-title">Aparecer no Google</h2>
            <p className="hint">
              {!profile.search_indexing
                ? "Desligado: sua página continua no ar para quem tem o link, mas não aparece nas buscas."
                : indexed
                  ? "Ligado: o Google pode mostrar sua página para quem buscar pelo seu nome. Pode levar alguns dias."
                  : "Ligado, mas sua página só entra nas buscas quando tiver nome ou bio e pelo menos um link ativo."}
            </p>
          </div>
          <form action={toggleSearchIndexing}>
            <input type="hidden" name="on" value={profile.search_indexing ? "0" : "1"} />
            <button className={`btn btn-sm ${profile.search_indexing ? "btn-outline" : "btn-primary"}`}>
              {profile.search_indexing ? "Desligar" : "Ligar"}
            </button>
          </form>
        </section>
      </main>

      <PhonePreview {...preview} />
    </div>
  );
}
