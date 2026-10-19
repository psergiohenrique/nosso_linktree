import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "./db";

const TZ = "America/Sao_Paulo";

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|curl|wget|python|axios|node-fetch|go-http/i;

// Ordem importa: o navegador interno do app vem antes do referrer.
const SOURCES: { key: string; ua?: RegExp; host?: RegExp }[] = [
  { key: "instagram", ua: /instagram/i, host: /(^|\.)instagram\.com$/ },
  { key: "facebook", ua: /FBAN|FBAV|FB_IAB/i, host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/ },
  { key: "tiktok", ua: /musical_ly|BytedanceWebview|TikTok/i, host: /(^|\.)tiktok\.com$/ },
  { key: "whatsapp", host: /(^|\.)(whatsapp\.com|wa\.me)$/ },
  { key: "google", host: /(^|\.)google\.[a-z.]+$/ },
  { key: "youtube", host: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { key: "x", ua: /Twitter/i, host: /(^|\.)(t\.co|x\.com|twitter\.com)$/ },
  { key: "linkedin", ua: /LinkedInApp/i, host: /(^|\.)(linkedin\.com|lnkd\.in)$/ },
];

export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  google: "Google",
  youtube: "YouTube",
  x: "X / Twitter",
  linkedin: "LinkedIn",
  direto: "Direto",
  outros: "Outros sites",
};

function referrerHost(referrer: string | null) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "").slice(0, 120);
  } catch {
    return null;
  }
}

export function classifySource(referrer: string | null, ua: string, ownHost: string | null) {
  const host = referrerHost(referrer);
  const external = host && host !== ownHost ? host : null;
  for (const s of SOURCES) {
    if ((s.ua && s.ua.test(ua)) || (external && s.host?.test(external))) return { source: s.key, host: external };
  }
  return { source: external ? "outros" : "direto", host: external };
}

type TrackInput = {
  profileId: string;
  linkId: string | null;
  type: "view" | "click";
  headers: Headers;
  referrer: string | null;
  utm?: Utm;
};

export type Utm = { source: string | null; medium: string | null; campaign: string | null };

const NO_UTM: Utm = { source: null, medium: null, campaign: null };

function utmValue(v: unknown) {
  if (typeof v !== "string") return null;
  const clean = v.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  return clean || null;
}

/** Normaliza os parâmetros utm_* vindos da página (minúsculos, no máximo 60 caracteres). */
export function parseUtm(raw: unknown): Utm {
  if (!raw || typeof raw !== "object") return NO_UTM;
  const r = raw as Record<string, unknown>;
  return { source: utmValue(r.source), medium: utmValue(r.medium), campaign: utmValue(r.campaign) };
}

function header(headers: Headers, name: string, max: number) {
  const raw = headers.get(name);
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {}
  value = value.trim().slice(0, max);
  return value || null;
}

/** Cidade, estado e país pelos cabeçalhos de geolocalização da Vercel (o IP em si não é guardado). */
export function geoFromHeaders(headers: Headers) {
  const country = header(headers, "x-vercel-ip-country", 2)?.toUpperCase() ?? null;
  return {
    city: header(headers, "x-vercel-ip-city", 80),
    region: header(headers, "x-vercel-ip-country-region", 10)?.toUpperCase() ?? null,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

/**
 * Registra um evento, a menos que seja robô, repetição recente do mesmo visitante
 * ou excesso de eventos (proteção contra inflar números).
 * O clique herda origem e campanha da última visualização do mesmo visitante, para saber
 * de onde vem quem clica em cada link.
 */
export async function trackEvent({ profileId, linkId, type, headers, referrer, utm = NO_UTM }: TrackInput) {
  const ua = headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return;

  const ip = (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "").trim();
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash("sha256")
    .update(`${process.env.APP_SECRET ?? ""}|${day}|${profileId}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);

  const ownHost = headers.get("host")?.replace(/^www\./, "").split(":")[0] ?? null;
  const { source, host } = classifySource(referrer, ua, ownHost);
  const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
  const geo = geoFromHeaders(headers);

  // Visualização: 1 por visitante a cada 30 min. Clique: 1 por link a cada 30 s.
  // Teto: 120 eventos por visitante por hora.
  await query(
    `insert into events (profile_id, link_id, type, source, referrer_host, device, visitor_hash,
                         city, region, country, utm_source, utm_medium, utm_campaign)
     select $1, $2, $3, coalesce(v.source, $4), coalesce(v.referrer_host, $5), $6, $7,
            $8, $9, $10, coalesce(v.utm_source, $11), coalesce(v.utm_medium, $12), coalesce(v.utm_campaign, $13)
       from (select 1) one
       left join lateral (
         select e.source, e.referrer_host, e.utm_source, e.utm_medium, e.utm_campaign from events e
          where $3 = 'click' and e.profile_id = $1 and e.visitor_hash = $7 and e.type = 'view'
          order by e.created_at desc limit 1
       ) v on true
     where exists (
         select 1 from profiles p where p.id = $1
           and ($2::uuid is null or exists (select 1 from links l where l.id = $2 and l.profile_id = $1))
       )
       and not exists (
         select 1 from events e
          where e.profile_id = $1 and e.visitor_hash = $7 and e.type = $3
            and e.link_id is not distinct from $2::uuid
            and e.created_at > now() - case when $3 = 'view' then interval '30 minutes' else interval '30 seconds' end
       )
       and (select count(*) from events e
             where e.profile_id = $1 and e.visitor_hash = $7 and e.created_at > now() - interval '1 hour') < 120`,
    [
      profileId,
      linkId,
      type,
      source,
      host,
      device,
      visitorHash,
      geo.city,
      geo.region,
      geo.country,
      utm.source,
      utm.medium,
      utm.campaign,
    ],
  );
}

export type DailyPoint = { day: string; views: number; clicks: number };
export type Breakdown = { key: string; count: number };
export type LinkStat = { id: string; title: string; kind: string; is_active: boolean; clicks: number };
export type Totals = { views: number; visitors: number; clicks: number; whatsapp: number };

const num = (v: string | number | undefined | null) => Number(v ?? 0);

// Início do período: dias de calendário no fuso de Brasília, incluindo hoje ($2 = número de dias).
const SINCE = `((date_trunc('day', now() at time zone '${TZ}') - make_interval(days => $2 - 1)) at time zone '${TZ}')`;
// Período anterior, do mesmo tamanho, logo antes.
const PREV_SINCE = `(${SINCE} - make_interval(days => $2))`;

type TotalsRow = {
  views: string;
  visitors: string;
  clicks: string;
  whatsapp: string;
  prev_views: string;
  prev_visitors: string;
  prev_clicks: string;
  prev_whatsapp: string;
};

function totalsFrom(r: TotalsRow | null, prefix: "" | "prev_"): Totals {
  const row = (r ?? {}) as Record<string, string | undefined>;
  return {
    views: num(row[`${prefix}views`]),
    visitors: num(row[`${prefix}visitors`]),
    clicks: num(row[`${prefix}clicks`]),
    whatsapp: num(row[`${prefix}whatsapp`]),
  };
}

/** Totais de duas janelas [start, mid) e [mid, end) (a segunda é o período atual). */
function totalsSql(start: string, mid: string, end = "now()") {
  return `select count(*) filter (where e.type = 'view' and e.created_at >= ${mid}) as views,
                 count(distinct e.visitor_hash) filter (where e.type = 'view' and e.created_at >= ${mid}) as visitors,
                 count(*) filter (where e.type = 'click' and e.created_at >= ${mid}) as clicks,
                 count(*) filter (where e.type = 'click' and l.kind = 'whatsapp' and e.created_at >= ${mid}) as whatsapp,
                 count(*) filter (where e.type = 'view' and e.created_at < ${mid}) as prev_views,
                 count(distinct e.visitor_hash) filter (where e.type = 'view' and e.created_at < ${mid}) as prev_visitors,
                 count(*) filter (where e.type = 'click' and e.created_at < ${mid}) as prev_clicks,
                 count(*) filter (where e.type = 'click' and l.kind = 'whatsapp' and e.created_at < ${mid}) as prev_whatsapp
            from events e left join links l on l.id = e.link_id
           where e.profile_id = $1 and e.created_at >= ${start} and e.created_at < ${end}`;
}

export async function getStats(profileId: string, days: number) {
  const since = SINCE;

  const [totals, daily, sources, devices, links] = await Promise.all([
    queryOne<TotalsRow>(totalsSql(PREV_SINCE, since), [profileId, days]),
    query<{ day: string; views: string; clicks: string }>(
      `select to_char(d, 'YYYY-MM-DD') as day,
              count(e.id) filter (where e.type = 'view') as views,
              count(e.id) filter (where e.type = 'click') as clicks
         from generate_series(
                (now() at time zone '${TZ}')::date - ($2 - 1),
                (now() at time zone '${TZ}')::date,
                interval '1 day') d
         left join events e on e.profile_id = $1 and e.created_at >= ${since}
                           and (e.created_at at time zone '${TZ}')::date = d::date
        group by d order by d`,
      [profileId, days],
    ),
    query<{ key: string; count: string }>(
      `select source as key, count(*) as count from events
        where profile_id = $1 and type = 'view' and created_at >= ${since}
        group by source order by count(*) desc`,
      [profileId, days],
    ),
    query<{ key: string; count: string }>(
      `select coalesce(device, 'desktop') as key, count(*) as count from events
        where profile_id = $1 and type = 'view' and created_at >= ${since}
        group by 1 order by count(*) desc`,
      [profileId, days],
    ),
    query<{ id: string; title: string; kind: string; is_active: boolean; clicks: string }>(
      `select l.id, l.title, l.kind, l.is_active,
              count(e.id) filter (where e.type = 'click' and e.created_at >= ${since}) as clicks
         from links l left join events e on e.link_id = l.id
        where l.profile_id = $1
        group by l.id order by clicks desc, l.position`,
      [profileId, days],
    ),
  ]);

  return {
    ...totalsFrom(totals, ""),
    previous: totalsFrom(totals, "prev_"),
    daily: daily.map((d) => ({ day: d.day, views: num(d.views), clicks: num(d.clicks) })),
    sources: sources.map((s) => ({ key: s.key, count: num(s.count) })),
    devices: devices.map((d) => ({ key: d.key, count: num(d.count) })),
    links: links.map((l) => ({ ...l, clicks: num(l.clicks) })),
  };
}

export type LinkSources = { id: string; title: string; kind: string; total: number; sources: Breakdown[] };
export type City = { city: string; region: string | null; count: number };
export type Campaign = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  views: number;
  clicks: number;
  whatsapp: number;
};

/** Métricas do plano Pro: origem de quem clica em cada link, horários, cidades e campanhas. */
export async function getAdvancedStats(profileId: string, days: number) {
  const since = SINCE;

  const [linkSources, heat, cities, campaigns] = await Promise.all([
    query<{ id: string; title: string; kind: string; source: string; count: string }>(
      `select l.id, l.title, l.kind, e.source, count(*) as count
         from events e join links l on l.id = e.link_id
        where e.profile_id = $1 and e.type = 'click' and e.created_at >= ${since}
        group by l.id, e.source`,
      [profileId, days],
    ),
    query<{ dow: number; hour: number; count: string }>(
      `select extract(isodow from created_at at time zone '${TZ}')::int as dow,
              extract(hour from created_at at time zone '${TZ}')::int as hour,
              count(*) as count
         from events
        where profile_id = $1 and type = 'view' and created_at >= ${since}
        group by 1, 2`,
      [profileId, days],
    ),
    query<{ city: string; region: string | null; count: string }>(
      `select city, region, count(*) as count from events
        where profile_id = $1 and type = 'view' and city is not null and created_at >= ${since}
        group by city, region order by count(*) desc limit 10`,
      [profileId, days],
    ),
    query<{ source: string | null; medium: string | null; campaign: string | null; views: string; clicks: string; whatsapp: string }>(
      `select e.utm_source as source, e.utm_medium as medium, e.utm_campaign as campaign,
              count(*) filter (where e.type = 'view') as views,
              count(*) filter (where e.type = 'click') as clicks,
              count(*) filter (where e.type = 'click' and l.kind = 'whatsapp') as whatsapp
         from events e left join links l on l.id = e.link_id
        where e.profile_id = $1 and e.created_at >= ${since}
          and coalesce(e.utm_source, e.utm_medium, e.utm_campaign) is not null
        group by 1, 2, 3 order by views desc, clicks desc limit 20`,
      [profileId, days],
    ),
  ]);

  const byLink = new Map<string, LinkSources>();
  for (const r of linkSources) {
    const item = byLink.get(r.id) ?? { id: r.id, title: r.title, kind: r.kind, total: 0, sources: [] };
    item.total += num(r.count);
    item.sources.push({ key: r.source, count: num(r.count) });
    byLink.set(r.id, item);
  }
  for (const item of byLink.values()) item.sources.sort((a, b) => b.count - a.count);

  // Grade 7 × 24: linha 0 = segunda-feira, coluna = hora (fuso de Brasília).
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const h of heat) heatmap[h.dow - 1][h.hour] = num(h.count);

  return {
    linkSources: [...byLink.values()].sort((a, b) => b.total - a.total),
    heatmap,
    cities: cities.map((c) => ({ city: c.city, region: c.region, count: num(c.count) })),
    campaigns: campaigns.map((c) => ({
      source: c.source,
      medium: c.medium,
      campaign: c.campaign,
      views: num(c.views),
      clicks: num(c.clicks),
      whatsapp: num(c.whatsapp),
    })),
  };
}

export type ExportRow = {
  at: string;
  type: "view" | "click";
  link: string | null;
  source: string;
  device: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

/** Eventos do período para exportar (sem o código do visitante). */
export function exportEvents(profileId: string, days: number) {
  return query<ExportRow>(
    `select to_char(e.created_at at time zone '${TZ}', 'YYYY-MM-DD HH24:MI:SS') as at, e.type, l.title as link,
            e.source, e.device, e.city, e.region, e.country, e.utm_source, e.utm_medium, e.utm_campaign
       from events e left join links l on l.id = e.link_id
      where e.profile_id = $1 and e.created_at >= ${SINCE}
      order by e.created_at`,
    [profileId, days],
  );
}

const DAY_START = `(date_trunc('day', now() at time zone '${TZ}') at time zone '${TZ}')`;

/**
 * Resumo da última semana fechada (7 dias até ontem, fuso de Brasília) comparada à anterior,
 * com o link mais clicado e a principal origem, para o e-mail semanal.
 */
export async function getWeeklySummary(profileId: string) {
  const weekStart = `(${DAY_START} - interval '7 days')`;
  const [totals, topLink, topSource] = await Promise.all([
    queryOne<TotalsRow>(totalsSql(`(${DAY_START} - interval '14 days')`, weekStart, DAY_START), [profileId]),
    queryOne<{ title: string; clicks: string }>(
      `select l.title, count(*) as clicks from events e join links l on l.id = e.link_id
        where e.profile_id = $1 and e.type = 'click' and e.created_at >= ${weekStart} and e.created_at < ${DAY_START}
        group by l.id order by count(*) desc limit 1`,
      [profileId],
    ),
    queryOne<{ source: string; count: string }>(
      `select source, count(*) as count from events
        where profile_id = $1 and type = 'view' and created_at >= ${weekStart} and created_at < ${DAY_START}
        group by source order by count(*) desc limit 1`,
      [profileId],
    ),
  ]);

  return {
    current: totalsFrom(totals, ""),
    previous: totalsFrom(totals, "prev_"),
    topLink: topLink ? { title: topLink.title, clicks: num(topLink.clicks) } : null,
    topSource: topSource ? { key: topSource.source, count: num(topSource.count) } : null,
  };
}
