import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { delta, pct, type Delta } from "@/lib/metrics";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { SOURCE_LABELS, getWeeklySummary } from "./analytics";
import { query, queryOne } from "./db";
import { sendMail } from "./mail";

/**
 * Resumo semanal por e-mail: toda segunda o cron (/api/cron/weekly-report) manda a cada conta
 * com visitas na semana os números dos últimos 7 dias, comparados à semana anterior.
 * Ligado por padrão; desliga pelo link do e-mail (assinado, sem login) ou pela aba Resultados.
 */

function sign(userId: string) {
  return createHmac("sha256", process.env.APP_SECRET ?? "").update(`weekly-report:${userId}`).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(userId: string) {
  return `${SITE_URL}/api/resumo/sair?u=${userId}&t=${sign(userId)}`;
}

export function isValidUnsubscribe(userId: string, token: string) {
  const a = Buffer.from(sign(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getWeeklyReportPref(userId: string) {
  const row = await queryOne<{ weekly_report: boolean }>("select weekly_report from users where id = $1", [userId]);
  return row?.weekly_report ?? false;
}

export async function setWeeklyReport(userId: string, on: boolean) {
  await query("update users set weekly_report = $2 where id = $1", [userId, on]);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fmt = (n: number) => n.toLocaleString("pt-BR");

type Summary = Awaited<ReturnType<typeof getWeeklySummary>>;

type EmailInput = { name: string; slug: string; summary: Summary; unsubscribe: string };

/** Monta assunto, texto e HTML do resumo (sem rede nem banco). */
export function buildWeeklyEmail({ name, slug, summary, unsubscribe }: EmailInput) {
  const { current: c, previous: p, topLink, topSource } = summary;
  const rows: { label: string; value: string; d: Delta | null }[] = [
    { label: "Conversas no WhatsApp", value: fmt(c.whatsapp), d: delta(c.whatsapp, p.whatsapp) },
    { label: "Visualizações", value: fmt(c.views), d: delta(c.views, p.views) },
    { label: "Visitantes únicos", value: fmt(c.visitors), d: delta(c.visitors, p.visitors) },
    { label: "Cliques", value: fmt(c.clicks), d: delta(c.clicks, p.clicks) },
    { label: "Taxa de clique", value: pct(c.clicks, c.views), d: null },
  ];
  if (c.whatsapp === 0 && p.whatsapp === 0) rows.shift();

  const headline =
    c.whatsapp > 0
      ? `${fmt(c.views)} visitas e ${fmt(c.whatsapp)} ${c.whatsapp === 1 ? "conversa" : "conversas"} no WhatsApp`
      : `${fmt(c.views)} visitas e ${fmt(c.clicks)} ${c.clicks === 1 ? "clique" : "cliques"}`;
  const subject = `Sua semana no ${SITE_NAME}: ${headline}`;
  const resultsUrl = `${SITE_URL}/dashboard/resultados?days=7`;
  const sourceLabel = topSource ? (SOURCE_LABELS[topSource.key] ?? topSource.key) : null;
  const hello = name ? `Oi, ${name}!` : "Oi!";
  const vs = (d: Delta | null) => (d ? ` (${d.label} vs. semana anterior)` : "");

  const highlights = [
    topLink && `Link mais clicado: ${topLink.title} (${fmt(topLink.clicks)} ${topLink.clicks === 1 ? "clique" : "cliques"})`,
    sourceLabel && topSource && `Principal origem das visitas: ${sourceLabel} (${pct(topSource.count, c.views)})`,
  ].filter((x): x is string => Boolean(x));

  const text = [
    hello,
    "",
    `Veja como foi a semana da sua página ${SITE_URL.replace(/^https?:\/\//, "")}/${slug} nos últimos 7 dias:`,
    "",
    ...rows.map((r) => `- ${r.label}: ${r.value}${vs(r.d)}`),
    ...(highlights.length ? ["", ...highlights] : []),
    "",
    `Resultados completos: ${resultsUrl}`,
    "",
    `Não quer mais receber este resumo? ${unsubscribe}`,
  ].join("\n");

  const color = (d: Delta | null) => (d?.dir === "up" || d?.dir === "new" ? "#1f9d55" : d?.dir === "down" ? "#c0392b" : "#6b6d70");
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;color:#17181a;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:16px">${escapeHtml(hello)}</p>
<p>Veja como foi a semana da sua página <a href="${SITE_URL}/${slug}" style="color:#17181a">/${escapeHtml(slug)}</a> nos últimos 7 dias:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows
    .map(
      (r) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #eee">${r.label}</td>
<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:800;font-size:18px">${r.value}</td>
<td style="padding:10px 0 10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;color:${color(r.d)};white-space:nowrap">${r.d?.label ?? ""}</td>
</tr>`,
    )
    .join("")}</table>
${highlights.map((h) => `<p style="margin:6px 0">${escapeHtml(h)}</p>`).join("")}
<p style="margin:24px 0"><a href="${resultsUrl}" style="background:#17181a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Ver resultados completos</a></p>
<p style="font-size:12px;color:#6b6d70">Percentuais comparados à semana anterior. Não quer mais receber este resumo? <a href="${unsubscribe}" style="color:#6b6d70">Descadastrar</a>.</p>
</div>`;

  return { subject, text, html };
}

/** Envia os resumos pendentes (no máximo `limit` por execução; o que sobrar vai na próxima). */
export async function sendWeeklyReports(limit = 100) {
  // Contas com o resumo ligado, sem envio nos últimos 6 dias e com visitas nos 7 dias até ontem.
  const users = await query<{ id: string; email: string; display_name: string; slug: string }>(
    `select u.id, u.email, p.display_name, p.slug
       from users u join profiles p on p.id = u.id
      where u.weekly_report
        and (u.weekly_report_sent_at is null or u.weekly_report_sent_at < now() - interval '6 days')
        and exists (
          select 1 from events e
           where e.profile_id = p.id and e.type = 'view'
             and e.created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '7 days') at time zone 'America/Sao_Paulo'
             and e.created_at < date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
        )
      order by u.id
      limit $1`,
    [limit],
  );

  let sent = 0;
  let failed = 0;
  for (const [i, u] of users.entries()) {
    // O Resend aceita poucas requisições por segundo.
    if (i > 0) await new Promise((r) => setTimeout(r, 600));
    const summary = await getWeeklySummary(u.id);
    const unsubscribe = unsubscribeUrl(u.id);
    const mail = buildWeeklyEmail({ name: u.display_name, slug: u.slug, summary, unsubscribe });
    const ok = await sendMail({
      to: u.email,
      ...mail,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }).catch(() => false);
    if (ok) {
      await query("update users set weekly_report_sent_at = now() where id = $1", [u.id]);
      sent++;
    } else {
      failed++;
    }
  }
  return { candidates: users.length, sent, failed };
}
