import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import BarList from "@/components/BarList";
import TrafficChart from "@/components/TrafficChart";
import { SOURCE_LABELS, getStats } from "@/server/analytics";
import { requireUser } from "@/server/auth";
import { getProfileByUser } from "@/server/profiles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resultados" };

const RANGES = [7, 30, 90];
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: rawDays } = await searchParams;
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);
  if (!profile) redirect("/dashboard");

  const days = RANGES.includes(Number(rawDays)) ? Number(rawDays) : 7;
  const stats = await getStats(profile.id, days);

  const kpis = [
    { label: "Visualizações", value: stats.views },
    { label: "Visitantes únicos", value: stats.visitors },
    { label: "Cliques", value: stats.clicks },
    { label: "Taxa de clique", value: pct(stats.clicks, stats.views) },
  ];

  return (
    <main className="dash-wide">
      <div className="dash-head dash-head-row">
        <div>
          <p className="eyebrow">Resultados</p>
          <h1 className="h2 dash-h1">Como sua página está indo</h1>
        </div>
        <nav className="range" aria-label="Período">
          {RANGES.map((r) => (
            <Link key={r} href={`/dashboard/resultados?days=${r}`} className={days === r ? "active" : ""}>
              {r} dias
            </Link>
          ))}
        </nav>
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-num">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <section className="card stat-card">
        <h2 className="card-title">Visualizações e cliques por dia</h2>
        <TrafficChart data={stats.daily} />
      </section>

      <div className="stat-cols">
        <section className="card stat-card">
          <h2 className="card-title">De onde vêm as visitas</h2>
          <BarList
            items={stats.sources.map((s) => ({ ...s, label: SOURCE_LABELS[s.key] ?? s.key }))}
            total={stats.views}
            empty="Sem visitas no período."
          />
        </section>
        <section className="card stat-card">
          <h2 className="card-title">Dispositivos</h2>
          <BarList
            items={stats.devices.map((d) => ({ ...d, label: d.key === "mobile" ? "Celular" : "Computador" }))}
            total={stats.views}
            empty="Sem visitas no período."
          />
        </section>
      </div>

      <section className="card stat-card">
        <h2 className="card-title">Cliques por link</h2>
        {stats.links.length === 0 ? (
          <p className="dash-empty">Nenhum link cadastrado.</p>
        ) : (
          <table className="rank">
            <thead>
              <tr>
                <th>#</th>
                <th>Link</th>
                <th className="num">Cliques</th>
                <th className="num">Taxa de clique</th>
              </tr>
            </thead>
            <tbody>
              {stats.links.map((l, i) => (
                <tr key={l.id} className={l.is_active ? "" : "rank-off"}>
                  <td className="rank-pos">{i + 1}</td>
                  <td>
                    {l.title}
                    {l.kind === "whatsapp" && <span className="link-kind link-kind-whats">WhatsApp</span>}
                    {!l.is_active && <span className="link-kind">Inativo</span>}
                  </td>
                  <td className="num">{l.clicks}</td>
                  <td className="num">{pct(l.clicks, stats.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="privacy-note">
        Sem IP e sem cookies de rastreio: cada visitante vira um código anônimo que muda todo dia. Robôs e
        repetições (mesma pessoa em 30 min) não contam.
      </p>
    </main>
  );
}
