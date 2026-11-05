"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

type Tab = { href: string; label: string; icon: React.ReactNode };

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="dash-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const LINKS_TAB: Tab = {
  href: "/dashboard",
  label: "Links",
  icon: (
    <Icon>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
  ),
};
const LOOK_TAB: Tab = {
  href: "/dashboard/aparencia",
  label: "Aparência",
  icon: (
    <Icon>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-1.4-1.2-1.6-1.2-2.9 0-1 .8-1.5 1.8-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </Icon>
  ),
};
const STATS_TAB: Tab = {
  href: "/dashboard/resultados",
  label: "Resultados",
  icon: (
    <Icon>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
  ),
};
const PLAN_TAB: Tab = {
  href: "/dashboard/plano",
  label: "Plano",
  icon: (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18" />
    </Icon>
  ),
};
const FORMS_TAB: Tab = {
  href: "/dashboard/formularios",
  label: "Formulários",
  icon: (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Icon>
  ),
};

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
  // Marca a aba tocada na hora, sem esperar a página nova chegar (vale só enquanto o caminho não mudou).
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);
  const nav = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

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

  const tabs = [LINKS_TAB, LOOK_TAB, STATS_TAB, ...(showForms ? [FORMS_TAB] : []), ...(showPlan ? [PLAN_TAB] : [])];
  const current = tapped && tapped.from === pathname ? tapped.href : pathname;
  // Formulários tem página de detalhe (/dashboard/formularios/<id>): a aba continua marcada nela.
  const isActive = (href: string) => current === href || (href === FORMS_TAB.href && current.startsWith(`${href}/`));

  // Pílula que desliza até a aba ativa (computador). O celular usa a barra inferior, sem a pílula.
  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("a.active");
    if (!el) return;
    const measure = () => setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [current, showForms, showPlan, showTabs]);

  if (!showTabs) return null;

  return (
    <nav ref={nav} className={`dash-tabs dash-nav${indicator ? " has-ind" : ""}`} aria-label="Seções do painel">
      {indicator && <span className="dash-ind" style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }} aria-hidden="true" />}
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={isActive(tab.href) ? "active" : ""}
          aria-current={isActive(tab.href) ? "page" : undefined}
          onClick={() => setTapped({ href: tab.href, from: pathname })}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
