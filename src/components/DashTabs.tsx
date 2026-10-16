"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Links" },
  { href: "/dashboard/aparencia", label: "Aparência" },
  { href: "/dashboard/resultados", label: "Resultados" },
];

const PLAN_TAB = { href: "/dashboard/plano", label: "Plano" };

export default function DashTabs({ showPlan = false }: { showPlan?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="dash-tabs" aria-label="Seções do painel">
      {(showPlan ? [...TABS, PLAN_TAB] : TABS).map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={pathname === tab.href ? "active" : ""}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
