import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// PostHog só no nosso site e no painel. As páginas públicas dos clientes (/[slug]) ficam sem
// cookies de rastreio, como prometido; as visitas delas chegam ao PostHog pelo servidor, sem cookie
// (src/server/posthog-events.ts).
const OWN_PATH = /^\/(?:$|login(?:\/|$)|dashboard(?:\/|$)|demo(?:\/|$))/;
const isOwnPath = (pathname: string) => OWN_PATH.test(pathname);

if (!isOwnPath(window.location.pathname)) {
  // Página de cliente: nada de PostHog no navegador.
} else if (!posthogKey) {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
    );
  }
} else if (!posthogHost) {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
    );
  }
} else {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    // Navegação interna do site até uma página de cliente: descarta o evento.
    before_send: (event) => {
      const url = event?.properties?.$current_url;
      if (typeof url === "string") {
        try {
          if (!isOwnPath(new URL(url).pathname)) return null;
        } catch {}
      }
      return event;
    },
  });
}
