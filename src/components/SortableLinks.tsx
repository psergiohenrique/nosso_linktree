"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import posthog from "posthog-js";

type Item = { id: string; label: string; node: React.ReactNode };

type Drag = {
  id: string;
  from: number;
  target: number;
  startY: number;
  startScroll: number;
  /** Posição (no documento) e altura de cada item quando o arrasto começou. */
  slots: { id: string; top: number; height: number }[];
  gap: number;
  pointerY: number;
  /** Soltou: o cartão está deslizando para o lugar novo; ignora o resto do movimento. */
  locked: boolean;
};

type View = { id: string; dy: number; target: number; from: number; shift: number; dropping: boolean };

const EDGE = 70; // px da borda da tela em que a página começa a rolar sozinha

/**
 * Lista de links que se reordena arrastando pela alça (mouse ou toque) ou com as setas do teclado na alça.
 * A ordem muda na hora na tela e é gravada em segundo plano; se falhar, volta à ordem do servidor.
 * Os cartões chegam prontos do servidor (`node`): aqui só se decide a ordem em que aparecem.
 */
export default function SortableLinks({
  items,
  onReorder,
}: {
  items: Item[];
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const [local, setLocal] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<View | null>(null);
  const [error, setError] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [, startTransition] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const state = useRef<Drag | null>(null);
  const raf = useRef(0);

  const byId = new Map(items.map((i) => [i.id, i]));
  const base = items.map((i) => i.id);
  const order = local ? [...local.filter((id) => byId.has(id)), ...base.filter((id) => !local.includes(id))] : base;

  function commit(next: string[], moved: Item) {
    setLocal(next);
    setError(false);
    setAnnounce(`${moved.label} movido para a posição ${next.indexOf(moved.id) + 1} de ${next.length}`);
    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
      posthog.capture("link_reordered");
    }
    startTransition(async () => {
      try {
        await onReorder(next);
      } catch {
        setError(true);
      } finally {
        setLocal(null);
      }
    });
  }

  function move(id: string, to: number) {
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || to === from) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next, byId.get(id)!);
  }

  function onKeyDown(e: React.KeyboardEvent, id: string) {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    move(id, order.indexOf(id) + delta);
    // O cartão muda de lugar no DOM; devolve o foco para a alça dele.
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-id="${id}"] .link-grip`)?.focus());
  }

  function update() {
    const d = state.current;
    if (!d || d.locked) return;
    const dy = d.pointerY - d.startY + (window.scrollY - d.startScroll);
    const me = d.slots[d.from];
    const center = me.top + me.height / 2 + dy;
    let target = 0;
    d.slots.forEach((s, i) => {
      if (i !== d.from && s.top + s.height / 2 < center) target++;
    });
    d.target = target;
    setDrag({ id: d.id, dy, target, from: d.from, shift: me.height + d.gap, dropping: false });
  }

  function loop() {
    const d = state.current;
    if (!d) return;
    if (d.locked) return;
    const h = window.innerHeight;
    const speed = d.pointerY < EDGE ? -((EDGE - d.pointerY) / EDGE) * 14 : d.pointerY > h - EDGE ? ((d.pointerY - (h - EDGE)) / EDGE) * 14 : 0;
    if (speed) {
      window.scrollBy(0, speed);
      update();
    }
    raf.current = requestAnimationFrame(loop);
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0 || state.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Cartões recolhidos têm todos a mesma altura: o cálculo de posição fica simples e a lista curta.
    list.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((d) => (d.open = false));
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>(".sortable-item") ?? [])];
    const slots = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.dataset.id!, top: r.top + window.scrollY, height: r.height };
    });
    const from = slots.findIndex((s) => s.id === id);
    if (from < 0) return;
    const gap = slots.length > 1 ? Math.max(0, slots[1].top - (slots[0].top + slots[0].height)) : 0;
    state.current = { id, from, target: from, startY: e.clientY, startScroll: window.scrollY, slots, gap, pointerY: e.clientY, locked: false };
    document.documentElement.classList.add("dragging-link");
    setDrag({ id, dy: 0, target: from, from, shift: slots[from].height + gap, dropping: false });
    raf.current = requestAnimationFrame(loop);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = state.current;
    if (!d || d.locked) return;
    d.pointerY = e.clientY;
    update();
  }

  function finish(cancel: boolean) {
    const d = state.current;
    if (!d || d.locked) return;
    cancelAnimationFrame(raf.current);
    document.documentElement.classList.remove("dragging-link");
    const to = cancel ? d.from : d.target;
    if (to === d.from) {
      state.current = null;
      setDrag(null);
      return;
    }
    // Desliza o cartão até o lugar novo e só então troca a ordem de verdade.
    const me = d.slots[d.from];
    const slot = d.slots[to];
    const finalDy = to > d.from ? slot.top + slot.height - me.height - me.top : slot.top - me.top;
    d.locked = true;
    setDrag({ id: d.id, dy: finalDy, target: to, from: d.from, shift: me.height + d.gap, dropping: true });
    window.setTimeout(() => {
      state.current = null;
      setDrag(null);
      move(d.id, to);
    }, 180);
  }

  // Quanto cada cartão sai do lugar enquanto se arrasta outro.
  function offset(index: number, id: string) {
    if (!drag) return 0;
    if (id === drag.id) return drag.dy;
    if (index > drag.from && index <= drag.target) return -drag.shift;
    if (index < drag.from && index >= drag.target) return drag.shift;
    return 0;
  }

  return (
    <>
      <div ref={list} className={`link-list${drag ? " is-sorting" : ""}`}>
        {order.map((id, index) => {
          const item = byId.get(id)!;
          const dy = offset(index, id);
          const dragging = drag?.id === id;
          return (
            <div
              key={id}
              data-id={id}
              className={`sortable-item${dragging ? " is-dragging" : ""}${dragging && drag?.dropping ? " is-dropping" : ""}`}
              style={dy ? { transform: `translateY(${dy}px)` } : undefined}
            >
              {item.node}
              {items.length > 1 && (
                <button
                  type="button"
                  className="link-grip"
                  aria-label={`Reordenar “${item.label}”: arraste, ou use as setas para cima e para baixo`}
                  onPointerDown={(e) => onPointerDown(e, id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => finish(false)}
                  onPointerCancel={() => finish(true)}
                  onKeyDown={(e) => onKeyDown(e, id)}
                >
                  <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">
                    {[3, 10, 17].map((y) => (
                      <g key={y}>
                        <circle cx="3.5" cy={y} r="1.6" />
                        <circle cx="10.5" cy={y} r="1.6" />
                      </g>
                    ))}
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          Não foi possível salvar a nova ordem. Ela voltou ao que estava.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
