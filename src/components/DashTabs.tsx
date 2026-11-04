"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

const TABS = [
  { href: "/dashboard", label: "Links" },
  { href: "/dashboard/aparencia", label: "Aparência" },
  { href: "/dashboard/resultados", label: "Resultados" },
];

const PLAN_TAB = { href: "/dashboard/plano", label: "Plano" };
const FORMS_TAB = { href: "/dashboard/formularios", label: "Formulários" };

type DashTabsProps = {
  showPlan?: boolean;
  showForms?: boolean;
  showTabs?: boolean;
  userId: string;
  email: string;
};

function isPostHogConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export default function DashTabs({ showPlan = false, showForms = false, showTabs = true, userId, email }: DashTabsProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPostHogConfigured()) return;

    posthog.identify(userId, { email });
  }, [email, userId]);

  useEffect(() => {
    function handleDashboardFormSubmission(event: Event) {
      if (!(event.target instanceof HTMLFormElement) || !isPostHogConfigured()) return;

      if (event.target.dataset.posthogLogout === "true") {
        posthog.reset();
        return;
      }

      const eventName = event.target.dataset.posthogEvent;
      if (!eventName) return;

      const cycle = event.target.dataset.posthogCycle;
      if (cycle) {
        posthog.capture(eventName, { billing_cycle: cycle });
      } else {
        posthog.capture(eventName);
      }
    }

    document.addEventListener("submit", handleDashboardFormSubmission);
    return () => document.removeEventListener("submit", handleDashboardFormSubmission);
  }, []);

  if (!showTabs) return null;

  const tabs = [...TABS, ...(showForms ? [FORMS_TAB] : []), ...(showPlan ? [PLAN_TAB] : [])];
  // Formulários tem página de detalhe (/dashboard/formularios/<id>): a aba continua marcada nela.
  const isActive = (href: string) => pathname === href || (href === FORMS_TAB.href && pathname.startsWith(`${href}/`));

  return (
    <nav className="dash-tabs" aria-label="Seções do painel">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={isActive(tab.href) ? "active" : ""}
          aria-current={isActive(tab.href) ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
