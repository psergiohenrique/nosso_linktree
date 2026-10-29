import "server-only";
import { PostHog } from "posthog-node";

let client: PostHog | undefined;

/** Envia somente dados controlados: erros e requisições podem conter informações pessoais. */
export async function captureServerError(digest: string | undefined, routeType: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;

  try {
    client ??= new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
    const safeDigest = digest && /^\d{1,32}$/.test(digest) ? digest : undefined;
    const safeRouteType = ["render", "route", "action", "proxy"].includes(routeType) ? routeType : "other";
    const error = new Error(safeDigest ? `Erro não tratado no servidor (${safeDigest})` : "Erro não tratado no servidor");
    // Não enviar stack original ou stack artificial, que podem conter caminhos internos.
    error.stack = undefined;
    await client.captureExceptionImmediate(error, undefined, {
      source: "nextjs_server",
      route_type: safeRouteType,
      ...(safeDigest && { digest: safeDigest }),
      $geoip_disable: true,
    });
  } catch {
    // Falhas de telemetria não devem causar outro erro na requisição.
    console.error("[posthog] falha ao enviar erro do servidor");
  }
}
