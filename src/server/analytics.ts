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
};

/**
 * Registra um evento, a menos que seja robô, repetição recente do mesmo visitante
 * ou excesso de eventos (proteção contra inflar números).
 */
export async function trackEvent({ profileId, linkId, type, headers, referrer }: TrackInput) {
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

  // Visualização: 1 por visitante a cada 30 min. Clique: 1 por link a cada 30 s.
  // Teto: 120 eventos por visitante por hora.
  await query(
    `insert into events (profile_id, link_id, type, source, referrer_host, device, visitor_hash)
     select $1, $2, $3, $4, $5, $6, $7
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
    [profileId, linkId, type, source, host, device, visitorHash],
  );
}

export type DailyPoint = { day: string; views: number; clicks: number };
export type Breakdown = { key: string; count: number };
export type LinkStat = { id: string; title: string; kind: string; is_active: boolean; clicks: number };

export async function getStats(profileId: string, days: number) {
  // Dias de calendário no fuso de Brasília, incluindo hoje.
  const since = `((date_trunc('day', now() at time zone '${TZ}') - make_interval(days => $2 - 1)) at time zone '${TZ}')`;

  const [totals, daily, sources, devices, links] = await Promise.all([
    queryOne<{ views: string; clicks: string; visitors: string }>(
      `select count(*) filter (where type = 'view') as views,
              count(*) filter (where type = 'click') as clicks,
              count(distinct visitor_hash) filter (where type = 'view') as visitors
         from events where profile_id = $1 and created_at >= ${since}`,
      [profileId, days],
    ),
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

  const num = (v: string | number | undefined | null) => Number(v ?? 0);
  return {
    views: num(totals?.views),
    clicks: num(totals?.clicks),
    visitors: num(totals?.visitors),
    daily: daily.map((d) => ({ day: d.day, views: num(d.views), clicks: num(d.clicks) })),
    sources: sources.map((s) => ({ key: s.key, count: num(s.count) })),
    devices: devices.map((d) => ({ key: d.key, count: num(d.count) })),
    links: links.map((l) => ({ ...l, clicks: num(l.clicks) })),
  };
}
