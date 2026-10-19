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

type DashTabsProps = {
  showPlan?: boolean;
  showTabs?: boolean;
  userId: string;
  email: string;
};

function isPostHogConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export default function DashTabs({ showPlan = false, showTabs = true, userId, email }: DashTabsProps) {
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
