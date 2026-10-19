import type { Metadata } from "next";
import Link from "next/link";
import DashTabs from "@/components/DashTabs";
import Logo from "@/components/Logo";
import { PaywallDialog } from "@/components/Paywall";
import { requireUser } from "@/server/auth";
import { billingEnabled, getPlan } from "@/server/billing";
import { getProfileByUser } from "@/server/profiles";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);

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
  const plan = await getPlan(user.id);

  return (
    <div className="dash">
      <header className="dash-top">
        <Logo />
        <DashTabs showPlan={billingEnabled()} userId={user.id} email={user.email} />
        <div className="dash-top-actions">
          <Link href={`/${profile.slug}`} target="_blank" className="btn btn-outline btn-sm">
            /{profile.slug} ↗
          </Link>
          <form action={signOut} data-posthog-logout="true">
            <button className="btn btn-outline btn-sm">Sair</button>
          </form>
        </div>
      </header>
      {children}
      {!plan.pro && <PaywallDialog />}
    </div>
  );
}
