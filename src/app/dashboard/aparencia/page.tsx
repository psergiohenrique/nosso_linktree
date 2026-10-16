import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppearanceEditor from "@/components/AppearanceEditor";
import { toPageViewProps } from "@/components/PageView";
import { requireUser } from "@/server/auth";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";
import { updateAppearance } from "../actions";

export const metadata: Metadata = { title: "Aparência" };

export default async function AparenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);
  if (!profile) redirect("/dashboard");

  const links = await getLinksByProfile(profile.id);
  const { profile: viewProfile, links: viewLinks } = toPageViewProps(profile, links.filter((l) => l.is_active));

  return (
    <>
      {error && <p className="notice notice-error dash-notice">{error}</p>}
      {ok && <p className="notice notice-ok dash-notice">Aparência salva.</p>}
      {/* key: remonta o editor com os dados salvos depois de cada envio */}
      <AppearanceEditor key={JSON.stringify(viewProfile)} profile={viewProfile} links={viewLinks} action={updateAppearance} />
    </>
  );
}
