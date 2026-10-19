import BarList from "./BarList";
import Heatmap from "./Heatmap";
import { SOURCE_LABELS, type getAdvancedStats } from "@/server/analytics";
import { pct } from "@/lib/metrics";

export type AdvancedData = Awaited<ReturnType<typeof getAdvancedStats>>;

const sourceLabel = (key: string) => SOURCE_LABELS[key] ?? key;

/** Seções do Pro na tela de Resultados (origem por link, horários, cidades e campanhas). */
export default function AdvancedStats({ data, views, pageUrl }: { data: AdvancedData; views: number; pageUrl: string }) {
  return (
    <>
      <section className="card stat-card">
        <h2 className="card-title">De onde vem quem clica em cada link</h2>
        {data.linkSources.length === 0 ? (
          <p className="dash-empty">Sem cliques no período.</p>
        ) : (
          <ul className="link-sources">
            {data.linkSources.map((l) => (
              <li key={l.id}>
                <div className="link-sources-head">
                  <span>
                    {l.title}
                    {l.kind === "whatsapp" && <span className="link-kind link-kind-whats">WhatsApp</span>}
                  </span>
                  <span className="link-sources-total">
                    {l.total} {l.total === 1 ? "clique" : "cliques"}
                  </span>
                </div>
                <p className="link-sources-list">
                  {l.sources.map((s) => (
                    <span key={s.key} className="source-chip">
                      {sourceLabel(s.key)} <strong>{pct(s.count, l.total)}</strong>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stat-card">
        <h2 className="card-title">Horários de pico</h2>
        <Heatmap data={data.heatmap} />
      </section>

      <div className="stat-cols">
        <section className="card stat-card">
          <h2 className="card-title">Cidades</h2>
          <BarList
            items={data.cities.map((c) => ({
              key: `${c.city}|${c.region ?? ""}`,
              label: c.region ? `${c.city} – ${c.region}` : c.city,
              count: c.count,
            }))}
            total={views}
            empty="Sem cidades identificadas no período."
          />
        </section>
        <section className="card stat-card">
          <h2 className="card-title">Campanhas</h2>
          {data.campaigns.length === 0 ? (
            <div className="dash-empty">
              <p>Nenhuma campanha no período. Para medir cada post, story ou anúncio, divulgue o link com UTM:</p>
              <code className="utm-example">{pageUrl}?utm_source=instagram&amp;utm_campaign=promo</code>
            </div>
          ) : (
            <table className="rank">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th className="num">Visitas</th>
                  <th className="num">Cliques</th>
                  <th className="num">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={`${c.source}|${c.medium}|${c.campaign}`}>
                    <td>
                      {c.campaign ?? "(sem nome)"}
                      <span className="hint campaign-meta">{[c.source, c.medium].filter(Boolean).join(" / ")}</span>
                    </td>
                    <td className="num">{c.views}</td>
                    <td className="num">{c.clicks}</td>
                    <td className="num">{c.whatsapp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

/** Dados de exemplo para a prévia borrada no Grátis (nada real do usuário). */
export const SAMPLE_ADVANCED: AdvancedData = {
  linkSources: [
    {
      id: "s1",
      title: "Agendar pelo WhatsApp",
      kind: "whatsapp",
      total: 128,
      sources: [
        { key: "instagram", count: 70 },
        { key: "google", count: 30 },
        { key: "direto", count: 28 },
      ],
    },
    {
      id: "s2",
      title: "Cardápio",
      kind: "link",
      total: 64,
      sources: [
        { key: "instagram", count: 40 },
        { key: "whatsapp", count: 24 },
      ],
    },
  ],
  heatmap: Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => (h < 8 ? 0 : Math.round((Math.sin((h - 8) / 4) + 1.2) * (d >= 4 ? 9 : 6)))),
  ),
  cities: [
    { city: "São Paulo", region: "SP", count: 180 },
    { city: "Campinas", region: "SP", count: 60 },
    { city: "Rio de Janeiro", region: "RJ", count: 40 },
  ],
  campaigns: [
    { source: "instagram", medium: "stories", campaign: "promo-semana", views: 120, clicks: 64, whatsapp: 40 },
    { source: "facebook", medium: "anuncio", campaign: "dia-das-maes", views: 90, clicks: 38, whatsapp: 22 },
  ],
};
