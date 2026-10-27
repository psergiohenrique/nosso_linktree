import type { Metadata } from "next";
import Link from "next/link";
import AdminTabs from "@/components/AdminTabs";
import Logo from "@/components/Logo";
import { requireAdmin } from "@/server/admin";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="dash">
      <header className="dash-top">
        <Logo />
        <AdminTabs />
        <div className="dash-top-actions">
          <Link href="/dashboard" className="btn btn-outline btn-sm">
            Meu painel
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
