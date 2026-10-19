// Comparação entre períodos, usada na tela de Resultados e no resumo semanal (sem banco: testável).

export type Delta = { dir: "up" | "down" | "flat" | "new"; label: string };

/** Variação percentual do atual sobre o anterior; null quando os dois são zero (nada a comparar). */
export function delta(current: number, previous: number): Delta | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { dir: "new", label: "novo" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { dir: "flat", label: "0%" };
  return { dir: pct > 0 ? "up" : "down", label: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%` };
}

/** Variação da taxa de clique em pontos percentuais. */
export function rateDelta(clicks: number, views: number, prevClicks: number, prevViews: number): Delta | null {
  if (views === 0 || prevViews === 0) return null;
  const pts = Math.round((clicks / views) * 100) - Math.round((prevClicks / prevViews) * 100);
  if (pts === 0) return { dir: "flat", label: "0 p.p." };
  return { dir: pts > 0 ? "up" : "down", label: `${pts > 0 ? "+" : "−"}${Math.abs(pts)} p.p.` };
}

export const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
