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

/** Use dentro de after(): não atrasa a resposta e nunca lança erro. */
export async function captureBioEvent(input: BioEvent) {
  if (!key || !host) return;
  try {
    const res = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bioEventPayload(input)),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error(`[posthog] evento recusado (${res.status})`);
  } catch (err) {
    console.error("[posthog] falha ao enviar evento", err);
  }
}
