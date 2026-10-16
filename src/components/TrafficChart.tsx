"use client";

import { useEffect, useRef, useState } from "react";

type Point = { day: string; views: number; clicks: number };

const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const SERIES = [
  { key: "views", label: "Visualizações", color: "var(--series-1)" },
  { key: "clicks", label: "Cliques", color: "var(--series-2)" },
] as const;

/** Topo do eixo em número redondo, dividido em 4 faixas. */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const rough = value / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= rough)! * pow;
  return step * 4;
}

const fmtDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n));

export default function TrafficChart({ data }: { data: Point[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Desenha na largura real (texto do eixo não escala junto com o gráfico).
  const [W, setW] = useState(640);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(...data.map((d) => Math.max(d.views, d.clicks)), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const xLabels = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

  const path = (key: "views" | "clicks") => data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key])}`).join("");
  const area = `${path("views")}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="chart">
      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key} className="chart-key">
            <span className="chart-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="chart-plot" ref={plotRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          aria-label="Visualizações e cliques por dia"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
                {fmtNum(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={H - 6} className="chart-tick" textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>
              {fmtDay(data[i].day)}
            </text>
          ))}

          <path d={area} fill="var(--series-1)" opacity={0.1} />
          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="chart-crosshair" />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(h[s.key])} r={4.5} fill={s.color} stroke="var(--white)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>

        {h && hover !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > data.length / 2 ? "calc(-100% - 12px)" : "12px"})`,
            }}
          >
            <strong>{fmtDay(h.day)}</strong>
            {SERIES.map((s) => (
              <span key={s.key} className="chart-key">
                <span className="chart-swatch" style={{ background: s.color }} />
                {s.label}: <b>{h[s.key]}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <details className="chart-table">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Visualizações</th>
              <th>Cliques</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <td>{fmtDay(d.day)}</td>
                <td>{d.views}</td>
                <td>{d.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
