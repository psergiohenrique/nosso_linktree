"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Cartões de plano: grade no computador; no celular (≤ 900px) uma fileira que se desliza com o dedo,
 * com o próximo cartão aparecendo na lateral e bolinhas indicando onde você está.
 * Abre centralizada no cartão marcado com `data-initial` (o plano atual ou a melhor oferta).
 */
export default function PlanCarousel({ labels, children }: { labels: string[]; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const cards = useCallback(() => [...(track.current?.children ?? [])] as HTMLElement[], []);

  const center = useCallback(
    (el: HTMLElement, behavior: ScrollBehavior) => {
      const t = track.current;
      if (!t) return;
      t.scrollTo({ left: el.offsetLeft - (t.clientWidth - el.offsetWidth) / 2, behavior });
    },
    [],
  );

  useLayoutEffect(() => {
    const t = track.current;
    if (!t || !window.matchMedia("(max-width: 900px)").matches) return;
    const start = cards().find((c) => c.hasAttribute("data-initial"));
    // O scroll dispara onScroll, que atualiza a bolinha ativa.
    if (start) center(start, "instant");
  }, [cards, center]);

  function onScroll() {
    const t = track.current;
    if (!t) return;
    const mid = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    cards().forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setActive(best);
  }

  return (
    <>
      <div ref={track} className="plan-grid" onScroll={onScroll}>
        {children}
      </div>
      <div className="plan-dots" role="group" aria-label="Planos">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i === active ? "active" : ""}
            aria-label={`Ver ${label}`}
            aria-current={i === active || undefined}
            onClick={() => center(cards()[i], "smooth")}
          />
        ))}
      </div>
    </>
  );
}
