"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

export const EDITOR_TABS = [
  { id: "links", href: "/dashboard", label: "Links", icon: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></> },
  { id: "aparencia", href: "/dashboard/aparencia", label: "Aparência", icon: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-1.4-1.2-1.6-1.2-2.9 0-1 .8-1.5 1.8-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></> },
  { id: "resultados", href: "/dashboard/resultados", label: "Resultados", icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { id: "formularios", href: "/dashboard/formularios", label: "Formulários", icon: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 8h6M9 12h6M9 16h3" /></> },
  { id: "plano", href: "/dashboard/plano", label: "Plano", icon: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></> },
] as const;

export type EditorTabId = (typeof EDITOR_TABS)[number]["id"];

type Props = {
  tabs: readonly (typeof EDITOR_TABS)[number][];
  active: EditorTabId;
  label: string;
  /** Sem callback, navega por rota; com ele, troca a aba no estado local. */
  onSelect?: (id: EditorTabId) => void;
  onNavigate?: (href: string) => void;
};

/** Única navegação visual do painel e demo (pílula no desktop, barra inferior no mobile). */
export default function EditorTabs({ tabs, active, label, onSelect, onNavigate }: Props) {
  const nav = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>(".active");
    if (!el) return;
    const measure = () => setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, tabs]);

  return (
    <nav ref={nav} className={`dash-tabs dash-nav${indicator ? " has-ind" : ""}`} aria-label={label}>
      {indicator && <span className="dash-ind" style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }} aria-hidden="true" />}
      {tabs.map((tab) => {
        const content = <><svg className="dash-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tab.icon}</svg><span>{tab.label}</span></>;
        return onSelect ? (
          <button key={tab.id} type="button" className={active === tab.id ? "active" : ""} aria-pressed={active === tab.id} onClick={() => onSelect(tab.id)}>{content}</button>
        ) : (
          <Link key={tab.id} href={tab.href} className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => onNavigate?.(tab.href)}>{content}</Link>
        );
      })}
    </nav>
  );
}
