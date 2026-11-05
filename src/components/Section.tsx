"use client";

import { useLayoutEffect, useRef } from "react";

const DESKTOP = "(min-width: 901px)";

/**
 * Bloco de um editor. Recolhível (`<details>`, um toque no título abre ou fecha) ou um cartão fixo.
 *
 * Quando abre por padrão: `defaultOpen` em qualquer tela; `desktopOpen` só no computador (o celular
 * começa recolhido, a página fica curta). Com `id`, o que a pessoa abrir ou fechar fica lembrado
 * neste navegador, separadamente para celular e computador.
 */
export default function Section({
  id,
  title,
  note,
  proTag = false,
  collapsible = false,
  defaultOpen = false,
  desktopOpen = false,
  children,
}: {
  /** Chave para lembrar o estado aberto/fechado. */
  id?: string;
  title: string;
  /** Texto curto ao lado do título (ex.: resumo do que está configurado). */
  note?: string;
  /** Etiqueta "Pro" ao lado do título: o recurso é do plano Pro e a seção convida a assinar. */
  proTag?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  desktopOpen?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const applying = useRef(false);
  const storageKey = (desktop: boolean) => `lb:sec:${id}:${desktop ? "d" : "m"}`;

  // Antes de pintar: aplica a escolha lembrada ou, sem ela, o padrão da tela. Abre/fecha pelo DOM
  // (o React só conhece o `open` inicial), por isso o evento toggle ignora esta mudança.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desktop = window.matchMedia(DESKTOP).matches;
    let open = defaultOpen || (desktop && desktopOpen);
    if (id) {
      try {
        const saved = localStorage.getItem(storageKey(desktop));
        if (saved !== null) open = saved === "1";
      } catch {
        // Armazenamento bloqueado: segue o padrão.
      }
    }
    if (el.open !== open) {
      applying.current = true;
      el.open = open;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!collapsible) {
    return (
      <section className="card">
        <h2 className="card-title">{title}</h2>
        {children}
      </section>
    );
  }
  return (
    <details
      ref={ref}
      className="sec"
      open={defaultOpen}
      onToggle={(e) => {
        // O toggle da mudança feita acima chega de forma assíncrona: só ele é descartado.
        if (applying.current) {
          applying.current = false;
          return;
        }
        if (!id) return;
        try {
          localStorage.setItem(storageKey(window.matchMedia(DESKTOP).matches), e.currentTarget.open ? "1" : "0");
        } catch {
          // Sem armazenamento, só não lembra.
        }
      }}
    >
      <summary className="sec-sum">
        <h2 className="sec-title">{title}</h2>
        {proTag && <span className="pro-tag sec-pro">Pro</span>}
        {note && <span className="sec-note">{note}</span>}
        <Chevron />
      </summary>
      <div className="sec-body">{children}</div>
    </details>
  );
}

export function Chevron() {
  return (
    <svg className="sec-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
