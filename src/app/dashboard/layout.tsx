import type { Metadata } from "next";
import Link from "next/link";
import DashTabs from "@/components/DashTabs";
import EditorShell from "@/components/EditorShell";
import SignOutButton from "@/components/SignOutButton";
import { PaywallDialog } from "@/components/Paywall";
import { SITE_NAME } from "@/lib/site";
import { requireUser } from "@/server/auth";
import { billingEnabled, getPlan } from "@/server/billing";
import { formsEnabled } from "@/server/forms";
import { getProfileByUser } from "@/server/profiles";
import { signOut } from "../login/actions";

// Título em objeto (com template) de propósito: um título em texto simples aqui zera o template do layout raiz
// para todas as páginas de dentro, e só a que não define título (Links) ficaria com " · Linkbio".
export const metadata: Metadata = {
  title: { default: `Painel · ${SITE_NAME}`, template: `%s · ${SITE_NAME}` },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Plano e acesso a Formulários só dependem do usuário: saem junto com o perfil, numa ida só ao banco.
  const [profile, plan, showForms] = await Promise.all([getProfileByUser(user.id), getPlan(user.id), formsEnabled(user.id)]);

  // Sem página criada ainda: a rota /dashboard mostra o formulário de criação, sem o menu.
  if (!profile) {
    return (
      <>
        <DashTabs showTabs={false} userId={user.id} email={user.email} />
        {children}
      </>
    );
  }

  // Aviso de recurso Pro: só para quem está no Grátis (com a cobrança desligada todos têm o Pro).
  return (
    <EditorShell
      navigation={<DashTabs showPlan={billingEnabled()} showForms={showForms} userId={user.id} email={user.email} />}
      actions={<>
        <Link
          href={`/${profile.slug}`}
          target="_blank"
          className="btn btn-outline btn-sm hdr-btn"
          aria-label={`Abrir minha página: /${profile.slug}`}
        >
          <span className="hdr-label">/{profile.slug} ↗</span>
          <svg className="hdr-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h6v6M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </Link>
        <SignOutButton action={signOut} />
      </>}
    >
      {children}
      {!plan.pro && <PaywallDialog />}
    </EditorShell>
  );
}
