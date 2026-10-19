import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdvancedStats, { SAMPLE_ADVANCED } from "@/components/AdvancedStats";
import BarList from "@/components/BarList";
import { PaywallButton } from "@/components/Paywall";
import TrafficChart from "@/components/TrafficChart";
import { toggleWeeklyReport } from "@/app/dashboard/actions";
import { SOURCE_LABELS, getAdvancedStats, getStats } from "@/server/analytics";
import { requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getProfileByUser } from "@/server/profiles";
import { getWeeklyReportPref } from "@/server/weekly-report";
import { FREE_STATS_DAYS } from "@/lib/billing";
import { delta, pct, rateDelta, type Delta } from "@/lib/metrics";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resultados" };

const RANGES = [7, 30, 90];
const sourceLabel = (key: string) => SOURCE_LABELS[key] ?? key;

const PRO_METRICS = [
  "De onde vem quem clica em cada link (Instagram, Google, WhatsApp…)",
  "Horários de pico: dia da semana e hora com mais visitas",
  "Cidades de onde vêm as visitas",
  "Campanhas com UTM: compare stories, anúncios e posts",
  "Exportação em planilha (CSV)",
];

function DeltaTag({ d, days }: { d: Delta | null; days: number }) {
  if (!d) return null;
  return (
    <span className={`kpi-delta kpi-delta-${d.dir}`} title={`Comparado aos ${days} dias anteriores`}>
      {d.dir === "up" ? "↑ " : d.dir === "down" ? "↓ " : ""}
      {d.label}
    </span>
  );
}

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
      <div className="dash-head-actions">
        {plan.pro ? (
          <a href={`/dashboard/resultados/csv?days=${days}`} className="btn btn-outline btn-sm" download>
            Exportar CSV
          </a>
        ) : (
          <PaywallButton feature="csv" className="btn btn-outline btn-sm">
            Exportar CSV <span className="pro-tag">Pro</span>
          </PaywallButton>
        )}
        <nav className="range" aria-label="Período">
          {RANGES.map((r) =>
            locked(r) && days !== r ? (
              <PaywallButton key={r} feature="stats" className="">
                {r} dias<span className="pro-tag">Pro</span>
              </PaywallButton>
            ) : (
              <Link key={r} href={`/dashboard/resultados?days=${r}`} className={days === r ? "active" : ""}>
                {r} dias{locked(r) && <span className="pro-tag">Pro</span>}
              </Link>
            ),
          )}
        </nav>
      </div>
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
            <PaywallButton feature="stats">Conhecer o Pro</PaywallButton>
            <Link href={`/dashboard/resultados?days=${FREE_STATS_DAYS}`} className="btn btn-outline btn-sm">
              Ver {FREE_STATS_DAYS} dias
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [stats, advanced, weeklyReport] = await Promise.all([
    getStats(profile.id, days),
    plan.pro ? getAdvancedStats(profile.id, days) : null,
    getWeeklyReportPref(user.id),
  ]);
  const prev = stats.previous;
  const hasWhats = stats.links.some((l) => l.kind === "whatsapp");

  const kpis = [
    { label: "Visualizações", value: stats.views, d: delta(stats.views, prev.views) },
    { label: "Visitantes únicos", value: stats.visitors, d: delta(stats.visitors, prev.visitors) },
    { label: "Cliques", value: stats.clicks, d: delta(stats.clicks, prev.clicks) },
    {
      label: "Taxa de clique",
      value: pct(stats.clicks, stats.views),
      d: rateDelta(stats.clicks, stats.views, prev.clicks, prev.views),
    },
  ];
  const pageUrl = `${SITE_URL}/${profile.slug}`;

  return (
    <main className="dash-wide">
      {header}

      <div className="kpis">
        <div className="kpi kpi-whats">
          <div className="kpi-num">{stats.whatsapp}</div>
          <div className="kpi-label">Conversas no WhatsApp</div>
          {hasWhats ? (
            <DeltaTag d={delta(stats.whatsapp, prev.whatsapp)} days={days} />
          ) : (
            <Link href="/dashboard" className="kpi-hint">
              Adicione um botão de WhatsApp →
            </Link>
          )}
        </div>
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-num">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
            <DeltaTag d={k.d} days={days} />
          </div>
        ))}
      </div>
      <p className="hint">
        Setas comparam com os {days} dias anteriores. Conversas no WhatsApp são cliques nos seus botões de WhatsApp.
      </p>

      <section className="card stat-card">
        <h2 className="card-title">Visualizações e cliques por dia</h2>
        <TrafficChart data={stats.daily} />
      </section>

      <div className="stat-cols">
        <section className="card stat-card">
          <h2 className="card-title">De onde vêm as visitas</h2>
          <BarList
            items={stats.sources.map((s) => ({ ...s, label: sourceLabel(s.key) }))}
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

      {advanced ? (
        <AdvancedStats data={advanced} views={stats.views} pageUrl={pageUrl} />
      ) : (
        // Grátis: as seções aparecem com dados de exemplo, borradas, e o clique abre o aviso do Pro.
        <div className="pro-locked">
          <div className="pro-locked-content" aria-hidden="true" inert>
            <AdvancedStats data={SAMPLE_ADVANCED} views={420} pageUrl={pageUrl} />
          </div>
          <div className="pro-locked-overlay">
            <div className="card pro-locked-card">
              <span className="pro-tag paywall-tag">Pro</span>
              <h2 className="card-title">Mais métricas no Pro</h2>
              <ul className="upsell-list">
                {PRO_METRICS.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <PaywallButton feature="stats">Desbloquear com o Pro</PaywallButton>
            </div>
          </div>
        </div>
      )}

      <section className="card weekly-card">
        <div>
          <h2 className="card-title">Resumo semanal por e-mail</h2>
          <p className="hint">
            {weeklyReport
              ? `Toda segunda você recebe em ${user.email} os números da semana, comparados à anterior.`
              : "Desligado. Ligue para receber toda segunda os números da semana no seu e-mail."}
          </p>
        </div>
        <form action={toggleWeeklyReport}>
          <input type="hidden" name="on" value={weeklyReport ? "0" : "1"} />
          <button className={`btn btn-sm ${weeklyReport ? "btn-outline" : "btn-primary"}`}>
            {weeklyReport ? "Desligar" : "Ligar resumo"}
          </button>
        </form>
      </section>

      <p className="privacy-note">
        Sem IP e sem cookies de rastreio: cada visitante vira um código anônimo que muda todo dia. A cidade é estimada
        pela rede e guardada só como nome. Robôs e repetições (mesma pessoa em 30 min) não contam.
      </p>
    </main>
  );
}
