"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import EditorTabs, { EDITOR_TABS } from "./EditorTabs";

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

/** Adaptador autenticado: rotas e telemetria não fazem parte da navegação visual. */
export default function DashTabs({ showPlan = false, showForms = false, showTabs = true, userId, email }: DashTabsProps) {
  const pathname = usePathname();
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);

  useEffect(() => {
    if (isPostHogConfigured()) posthog.identify(userId, { email });
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
      if (cycle) posthog.capture(eventName, { billing_cycle: cycle });
      else posthog.capture(eventName);
    }
    document.addEventListener("submit", handleDashboardFormSubmission);
    return () => document.removeEventListener("submit", handleDashboardFormSubmission);
  }, []);

  const tabs = EDITOR_TABS.filter((tab) => (tab.id !== "plano" || showPlan) && (tab.id !== "formularios" || showForms));
  const current = tapped && tapped.from === pathname ? tapped.href : pathname;
  const active = tabs.find((tab) => current === tab.href || (tab.id === "formularios" && current.startsWith(`${tab.href}/`)))?.id ?? "links";
  if (!showTabs) return null;
  return <EditorTabs tabs={tabs} active={active} label="Seções do painel" onNavigate={(href) => setTapped({ href, from: pathname })} />;
}
