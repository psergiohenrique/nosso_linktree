import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppearanceEditor from "@/components/AppearanceEditor";
import { toPageViewProps } from "@/components/to-page-view";
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

  const [links, plan] = await Promise.all([getLinksByProfile(profile.id), getPlan(user.id)]);
  const {
    profile: viewProfile,
    links: viewLinks,
    branding,
  } = toPageViewProps(profile, links.filter((l) => l.is_active), plan);

  const message = error
    ? ({ kind: "error", text: error } as const)
    : endereco
      ? ({ kind: "ok", text: "Endereço atualizado." } as const)
      : ok
        ? ({ kind: "ok", text: "Alterações salvas." } as const)
        : undefined;

  return (
    <AppearanceEditor
      profile={viewProfile}
      links={viewLinks}
      branding={branding}
      pro={plan.pro}
      action={updateAppearance}
      slugAction={updateSlug}
      version={new Date(profile.updated_at).toISOString()}
      message={message}
      socialPosition={profile.social_position}
      socialLinks={profile.social_links}
    />
  );
}
