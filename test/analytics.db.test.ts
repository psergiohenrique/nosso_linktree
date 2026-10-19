// Coleta e consultas de métricas no Postgres. Só roda com TEST_DATABASE_URL.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdvancedStats, getStats, getWeeklySummary, trackEvent } from "@/server/analytics";
import { pool, query, queryOne } from "@/server/db";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0";

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: métricas", () => {
  let userId = "";
  let whatsId = "";
  let siteId = "";

  beforeAll(async () => {
    const user = await queryOne<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'x') returning id",
      [`metricas-${randomUUID()}@linkbio.test`],
    );
    userId = user!.id;
    await query("insert into profiles (id, slug) values ($1, $2)", [userId, `m-${userId.slice(0, 8)}`]);
    const links = await query<{ id: string }>(
      `insert into links (profile_id, kind, title, url, position)
       values ($1, 'whatsapp', 'Zap', 'https://wa.me/1', 0), ($1, 'link', 'Site', 'https://example.com', 1)
       returning id`,
      [userId],
    );
    [whatsId, siteId] = links.map((l) => l.id);
  });

  afterAll(async () => {
    await query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("clique herda origem e campanha da visualização; cidade vem dos cabeçalhos", async () => {
    const headers = new Headers({
      "user-agent": UA,
      "x-forwarded-for": "10.0.0.1",
      "x-vercel-ip-city": "Recife",
      "x-vercel-ip-country-region": "PE",
      "x-vercel-ip-country": "BR",
    });
    await trackEvent({
      profileId: userId,
      linkId: null,
      type: "view",
      headers,
      referrer: null,
      utm: { source: "instagram", medium: "stories", campaign: "promo" },
    });
    await trackEvent({ profileId: userId, linkId: whatsId, type: "click", headers, referrer: null });

    const click = await queryOne<{ source: string; utm_campaign: string; city: string }>(
      "select source, utm_campaign, city from events where link_id = $1",
      [whatsId],
    );
    expect(click).toEqual({ source: "instagram", utm_campaign: "promo", city: "Recife" });
  });

  it("totais com WhatsApp e período anterior", async () => {
    // Evento de 10 dias atrás cai no período anterior de 7 dias.
    await query(
      `insert into events (profile_id, link_id, type, source, visitor_hash, created_at)
       values ($1, null, 'view', 'google', 'old', now() - interval '10 days'),
              ($1, $2, 'click', 'google', 'old', now() - interval '10 days')`,
      [userId, siteId],
    );
    const stats = await getStats(userId, 7);
    expect(stats).toMatchObject({ views: 1, visitors: 1, clicks: 1, whatsapp: 1 });
    expect(stats.previous).toEqual({ views: 1, visitors: 1, clicks: 1, whatsapp: 0 });
  });

  it("métricas Pro: origem por link, cidades, campanhas e horários", async () => {
    const adv = await getAdvancedStats(userId, 7);
    expect(adv.linkSources).toEqual([
      { id: whatsId, title: "Zap", kind: "whatsapp", total: 1, sources: [{ key: "instagram", count: 1 }] },
    ]);
    expect(adv.cities).toEqual([{ city: "Recife", region: "PE", count: 1 }]);
    expect(adv.campaigns).toEqual([
      { source: "instagram", medium: "stories", campaign: "promo", views: 1, clicks: 1, whatsapp: 1 },
    ]);
    expect(adv.heatmap.flat().reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("resumo semanal considera os 7 dias até ontem", async () => {
    const summary = await getWeeklySummary(userId);
    // Os eventos de hoje ficam fora; o de 10 dias atrás está na semana anterior.
    expect(summary.current.views).toBe(0);
    expect(summary.previous).toEqual({ views: 1, visitors: 1, clicks: 1, whatsapp: 0 });
  });
});
