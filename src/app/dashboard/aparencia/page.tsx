import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppearanceEditor from "@/components/AppearanceEditor";
import { toPageViewProps } from "@/components/PageView";
import { requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { updateAppearance, updateSlug } from "../actions";

export const metadata: Metadata = { title: "Aparência" };

export default async function AparenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; endereco?: string }>;
}) {
  const { error, ok, endereco } = await searchParams;
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);
  if (!profile) redirect("/dashboard");

  const links = await getLinksByProfile(profile.id);
  const plan = await getPlan(user.id);
  const {
    profile: viewProfile,
    links: viewLinks,
    branding,
  } = toPageViewProps(profile, links.filter((l) => l.is_active), plan.pro);

  return (
    <>
      {error && <p className="notice notice-error dash-notice">{error}</p>}
      {ok && <p className="notice notice-ok dash-notice">Aparência salva.</p>}
      {endereco && <p className="notice notice-ok dash-notice">Endereço atualizado.</p>}
      <form action={updateSlug} className="card">
        <h2 className="card-title">Endereço da página</h2>
        <label htmlFor="slug">Endereço</label>
        <input id="slug" name="slug" className="field" defaultValue={profile.slug} minLength={3} maxLength={30} required />
        <p className="hint">Use letras, números ou hífen. Ao alterar, o endereço antigo deixa de funcionar.</p>
        <button className="btn btn-outline" type="submit">Salvar endereço</button>
      </form>
      {/* key: remonta o editor com os dados salvos depois de cada envio */}
      <AppearanceEditor
        key={JSON.stringify(viewProfile)}
        profile={viewProfile}
        links={viewLinks}
        branding={branding}
        pro={plan.pro}
        action={updateAppearance}
      />
    </>
  );
}
