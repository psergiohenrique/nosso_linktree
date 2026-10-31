import "server-only";
import type { TrackedEvent } from "./analytics";

/**
 * Visitas e cliques das páginas públicas, enviados ao PostHog pelo servidor (sem cookie no visitante
 * e sem bloqueio por adblock). Servem para nós vermos quais clientes têm movimento; as métricas do
 * cliente continuam saindo do nosso banco (src/server/analytics.ts).
 *
 * distinct_id = id do perfil, que é o id do usuário dono: os eventos caem na mesma pessoa que o
 * painel identifica (DashTabs). Não vai IP nem código do visitante; o GeoIP fica desligado porque o
 * IP da requisição seria o do servidor.
 */

const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "");

type BioEvent = {
  profileId: string;
  event: TrackedEvent;
  link?: { id: string; kind: string };
};

export function bioEventPayload({ profileId, event, link }: BioEvent) {
  return {
    api_key: key,
    event: link ? "bio_link_clicked" : "bio_page_viewed",
    distinct_id: profileId,
    timestamp: new Date().toISOString(),
    properties: {
      $geoip_disable: true,
      profile_id: profileId,
      source: event.source,
      device: event.device,
      city: event.city,
      region: event.region,
      country: event.country,
      utm_source: event.utm_source,
      utm_medium: event.utm_medium,
      utm_campaign: event.utm_campaign,
      ...(link && { link_id: link.id, link_kind: link.kind }),
    },
  };
}

/**
 * Eventos de autenticação. Nunca incluem e-mail nem token.
 * distinctId é o id do usuário; sem id (token inválido) o evento não cria pessoa no PostHog.
 */
export type AuthCapture =
  | { event: "magic_link_requested"; distinctId: string }
  | { event: "magic_link_login_succeeded"; distinctId: string }
  | { event: "magic_link_login_failed"; distinctId: string; reason: "expired" | "used" | "invalid" }
  | { event: "login_succeeded"; distinctId: string; method: "password" };

function safeDistinctId(id: string) {
  if (!id || id.includes("@") || id.includes("token=")) return "";
  return id;
}

export function authEventPayload(input: AuthCapture, now = new Date()) {
  const distinctId = safeDistinctId(input.distinctId);
  const anonymous = !distinctId;
  const properties: Record<string, unknown> = { $geoip_disable: true };
  if (anonymous) properties.$process_person_profile = false;
  if (input.event === "magic_link_login_failed") properties.reason = input.reason;
  if (input.event === "login_succeeded") properties.method = input.method;
  return {
    api_key: key,
    event: input.event,
    distinct_id: anonymous ? "magic-link" : distinctId,
    timestamp: now.toISOString(),
    properties,
  };
}

async function postToPostHog(payload: unknown) {
  if (!key || !host) return;
  try {
    const res = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error(`[posthog] evento recusado (${res.status})`);
  } catch (err) {
    console.error("[posthog] falha ao enviar evento", err);
  }
}

/** Use dentro de after(): não atrasa a resposta e nunca lança erro. */
export async function captureBioEvent(input: BioEvent) {
  await postToPostHog(bioEventPayload(input));
}

/** Use dentro de after(): não atrasa a resposta e nunca lança erro. */
export async function captureAuthEvent(input: AuthCapture) {
  await postToPostHog(authEventPayload(input));
}
