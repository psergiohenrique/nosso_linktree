import type { Metadata } from "next";
import Link from "next/link";
import LinksEditor from "@/components/LinksEditor";
import BioGuide from "@/components/BioGuide";
import { EditorGrid } from "@/components/EditorShell";
import Logo from "@/components/Logo";
import { toPageViewProps } from "@/components/PageView";
import PhonePreview from "@/components/PhonePreview";
import ProfileChecklist from "@/components/ProfileChecklist";
import ProfileQRCode from "@/components/ProfileQRCode";
import SignupSteps from "@/components/SignupSteps";
import Toast from "@/components/Toast";
import { mediaUrl } from "@/lib/types";
import { SITE_HOST, SITE_URL } from "@/lib/site";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import { profileChecklist } from "@/lib/profile-checklist";
import { isIndexable } from "@/lib/seo";
import { getUserName, requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { addLink, createProfile, deleteLink, reorderLinks, toggleSearchIndexing, updateLink } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Links" };

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
    <EditorGrid preview={<PhonePreview {...preview} />}>
      {errorMessage && (
        <Toast key={errorMessage} kind="error">
          {errorMessage}
        </Toast>
      )}
      <ProfileChecklist items={profileChecklist(profile, links)} />

      <LinksEditor
        links={links.map(({ id, kind, title, url, layout, size, is_active, thumbnail_id }) => ({
          id, kind, title, url, layout, size, is_active, thumbnail_url: thumbnail_id ? mediaUrl(thumbnail_id) : null,
        }))}
        actions={{ create: addLink, update: updateLink, remove: deleteLink, reorder: reorderLinks }}
        access={{ proLayouts: plan.pro, atLimit, limit: FREE_LINK_LIMIT }}
        trackEvents
        beforeLinks={!plan.pro && (
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
      />

      {preview.links.length > 0 && <BioGuide url={`${SITE_URL}/${profile.slug}`} />}

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
    </EditorGrid>
  );
}
