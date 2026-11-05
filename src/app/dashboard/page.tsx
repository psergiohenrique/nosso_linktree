import type { Metadata } from "next";
import Link from "next/link";
import DeleteLinkButton from "@/components/DeleteLinkButton";
import ImageField from "@/components/ImageField";
import LinkOptions from "@/components/LinkOptions";
import NewLinkSheet from "@/components/NewLinkSheet";
import Logo from "@/components/Logo";
import { toPageViewProps, WhatsappIcon } from "@/components/PageView";
import PhonePreview from "@/components/PhonePreview";
import ProfileQRCode from "@/components/ProfileQRCode";
import { Chevron } from "@/components/Section";
import SortableLinks from "@/components/SortableLinks";
import SignupSteps from "@/components/SignupSteps";
import SubmitButton from "@/components/SubmitButton";
import Toast from "@/components/Toast";
import { mediaUrl } from "@/lib/types";
import { SITE_HOST } from "@/lib/site";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import { isIndexable } from "@/lib/seo";
import { getUserName, requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { addLink, createProfile, deleteLink, reorderLinks, toggleSearchIndexing, updateLink } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Links" };

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

  const [links, plan] = await Promise.all([getLinksByProfile(profile.id), getPlan(user.id)]);
  const preview = toPageViewProps(profile, links.filter((l) => l.is_active), plan.pro);
  const atLimit = !plan.pro && links.length >= FREE_LINK_LIMIT;
  const indexed = isIndexable(profile, preview.links.length);

  return (
    <div className="dash-grid">
      <main className="dash-main enter">
        {errorMessage && (
          <Toast key={errorMessage} kind="error">
            {errorMessage}
          </Toast>
        )}
        <div className="dash-head dash-head-row">
          <div>
            <p className="eyebrow">Links</p>
            <h1 className="h2 dash-h1">Seus links</h1>
          </div>
          <button type="button" className="btn btn-primary" data-new-link>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo link
          </button>
        </div>

        {!plan.pro && (
          <div className="upsell">
            <div className="upsell-main">
              <p className="upsell-title">
                <span className="pro-tag">Pro</span>
                <span>
                  <strong>
                    {Math.min(links.length, FREE_LINK_LIMIT)} de {FREE_LINK_LIMIT} links
                  </strong>{" "}
                  no plano Grátis
                </span>
              </p>
              <div
                className="upsell-meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={FREE_LINK_LIMIT}
                aria-valuenow={Math.min(links.length, FREE_LINK_LIMIT)}
                aria-label="Links usados no plano Grátis"
              >
                <span style={{ width: `${(Math.min(links.length, FREE_LINK_LIMIT) / FREE_LINK_LIMIT) * 100}%` }} />
              </div>
              <p className="upsell-text">
                {links.length > FREE_LINK_LIMIT ? `Só os ${FREE_LINK_LIMIT} primeiros ativos aparecem na sua página. ` : ""}
                No Pro: links ilimitados, Destaque e Bloco, e sem o selo.
              </p>
            </div>
            <Link href="/dashboard/plano" className="btn btn-outline btn-sm upsell-cta">
              Conhecer o Pro <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}

        <NewLinkSheet action={addLink} proLayouts={plan.pro} atLimit={atLimit} limit={FREE_LINK_LIMIT} />

        {links.length === 0 && (
          <div className="link-empty">
            <strong>Nenhum link ainda</strong>
            <span>Adicione seu WhatsApp, Instagram, cardápio ou qualquer endereço. Ele aparece na prévia na hora.</span>
            <button type="button" className="btn btn-primary" data-new-link>
              Adicionar o primeiro link
            </button>
          </div>
        )}

        <SortableLinks
          onReorder={reorderLinks}
          items={links.map((link) => {
            const wa = link.kind === "whatsapp" ? splitWhatsapp(link.url) : null;
            return {
              id: link.id,
              label: link.title,
              node: (
                <details key={link.id} className={`link-card ${link.is_active ? "" : "card-off"}`}>
                  <summary className="link-sum">
                    {link.thumbnail_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(link.thumbnail_id)} alt="" width={40} height={40} className="link-thumb" loading="lazy" />
                    ) : (
                      <div className={`link-thumb link-thumb-empty ${wa ? "link-thumb-whats" : ""}`} aria-hidden="true">
                        {wa ? (
                          <WhatsappIcon className="link-thumb-icon" />
                        ) : (
                          <svg className="link-thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                            <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                          </svg>
                        )}
                      </div>
                    )}
                    <span className="link-sum-text">
                      <span className="link-sum-title">{link.title}</span>
                      <span className="link-sum-url">{wa ? `WhatsApp ${wa.phone}` : link.url.replace(/^https?:\/\//, "")}</span>
                    </span>
                    {!link.is_active && <span className="link-tag">Inativo</span>}
                    <Chevron />
                  </summary>
                  <div className="link-body">
                    <form action={updateLink} className="link-form" data-posthog-event="link_updated">
                      <input type="hidden" name="id" value={link.id} />
                      <input type="hidden" name="kind" value={link.kind} />
                      <div>
                        <label className="field-label" htmlFor={`title-${link.id}`}>
                          Título
                        </label>
                        <input id={`title-${link.id}`} name="title" defaultValue={link.title} required maxLength={80} className="field" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`url-${link.id}`}>
                          {wa ? "WhatsApp com DDD" : "Link"}
                        </label>
                        <input
                          id={`url-${link.id}`}
                          name="url"
                          defaultValue={wa ? wa.phone : link.url}
                          placeholder={wa ? "11 99999-9999" : "https://…"}
                          required
                          inputMode={wa ? "tel" : "url"}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          className="field"
                        />
                      </div>
                      {wa && (
                        <div className="lf-full">
                          <label className="field-label" htmlFor={`message-${link.id}`}>
                            Mensagem inicial <span className="field-optional">(opcional)</span>
                          </label>
                          <input id={`message-${link.id}`} name="message" defaultValue={wa.message} placeholder="Ex.: Quero agendar" className="field" />
                        </div>
                      )}
                      <div className="lf-full">
                        <LinkOptions layout={link.layout} size={link.size} proLayouts={plan.pro} />
                      </div>
                      <div className="lf-full lf-row">
                        <span className="lf-image">
                          <ImageField name="thumbnail" hasImage={!!link.thumbnail_id} />
                          {link.thumbnail_id && (
                            <label className="check">
                              <input type="checkbox" name="remove_thumbnail" /> Remover imagem
                            </label>
                          )}
                        </span>
                        <label className="card-switch">
                          <span className="switch">
                            <input type="checkbox" name="is_active" defaultChecked={link.is_active} />
                            <span className="switch-track" />
                          </span>
                          Ativo na página
                        </label>
                      </div>
                      <SubmitButton className="btn btn-primary btn-sm lf-save" pendingLabel="Salvando…">
                        Salvar
                      </SubmitButton>
                    </form>
                    <div className="lf-delete">
                      <DeleteLinkButton id={link.id} title={link.title} action={deleteLink} />
                    </div>
                  </div>
                </details>
              ),
            };
          })}
        />

        <ProfileQRCode slug={profile.slug} />

        <section className="card setting-card">
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

      <PhonePreview {...preview} aboveTabBar />
    </div>
  );
}
