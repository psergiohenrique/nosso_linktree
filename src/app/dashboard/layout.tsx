import type { Metadata } from "next";
import Link from "next/link";
import DashTabs from "@/components/DashTabs";
import Logo from "@/components/Logo";
import { requireUser } from "@/server/auth";
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
  if (!profile) return children;

  return (
    <div className="dash">
      <header className="dash-top">
        <Logo />
        <DashTabs />
        <div className="dash-top-actions">
          <Link href={`/${profile.slug}`} target="_blank" className="btn btn-outline btn-sm">
            /{profile.slug} ↗
          </Link>
          <form action={signOut}>
            <button className="btn btn-outline btn-sm">Sair</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
