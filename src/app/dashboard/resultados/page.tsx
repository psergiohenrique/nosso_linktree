import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import BarList from "@/components/BarList";
import TrafficChart from "@/components/TrafficChart";
import { SOURCE_LABELS, getStats } from "@/server/analytics";
import { requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getProfileByUser } from "@/server/profiles";
import { FREE_STATS_DAYS } from "@/lib/billing";

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
  const plan = await getPlan(user.id);
  const locked = (d: number) => !plan.pro && d > FREE_STATS_DAYS;

  const header = (
    <div className="dash-head dash-head-row">
      <div>
        <p className="eyebrow">Resultados</p>
        <h1 className="h2 dash-h1">Como sua página está indo</h1>
      </div>
      <nav className="range" aria-label="Período">
        {RANGES.map((r) => (
          <Link key={r} href={`/dashboard/resultados?days=${r}`} className={days === r ? "active" : ""}>
            {r} dias{locked(r) && <span className="pro-tag">Pro</span>}
          </Link>
        ))}
      </nav>
    </div>
  );

  if (locked(days)) {
    return (
      <main className="dash-wide">
        {header}
        <section className="card upsell-card">
          <h2 className="card-title">Resultados de {days} dias são do plano Pro</h2>
          <p className="auth-text">
            No Grátis você acompanha os últimos {FREE_STATS_DAYS} dias. Com o Pro, vê a evolução de 30 e 90 dias para
            saber o que realmente traz clientes.
          </p>
          <div className="card-row">
            <Link href="/dashboard/plano" className="btn btn-primary btn-sm">
              Conhecer o Pro
            </Link>
            <Link href={`/dashboard/resultados?days=${FREE_STATS_DAYS}`} className="btn btn-outline btn-sm">
              Ver {FREE_STATS_DAYS} dias
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const stats = await getStats(profile.id, days);

  const kpis = [
    { label: "Visualizações", value: stats.views },
    { label: "Visitantes únicos", value: stats.visitors },
    { label: "Cliques", value: stats.clicks },
    { label: "Taxa de clique", value: pct(stats.clicks, stats.views) },
  ];

  return (
    <main className="dash-wide">
      {header}

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
