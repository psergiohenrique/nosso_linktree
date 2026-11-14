import { afterEach, describe, expect, it, vi } from "vitest";

const init = vi.hoisted(() => vi.fn());
vi.mock("posthog-js", () => ({ default: { init } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  init.mockReset();
});

async function initialize(pathname: string) {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "test-token");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.example");
  vi.stubGlobal("window", { location: { pathname } });
  await import("../instrumentation-client");
}

describe("PostHog no navegador", () => {
  it("inicializa nas páginas do site e habilita captura de exceções", async () => {
    await initialize("/dashboard");
    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith("test-token", expect.objectContaining({
      api_host: "https://posthog.example",
      capture_exceptions: true,
    }));
  });

  it("não inicializa diretamente em páginas públicas de clientes", async () => {
    await initialize("/minha-pagina");
    expect(init).not.toHaveBeenCalled();
  });

  it("descarta eventos de páginas públicas após navegação interna", async () => {
    await initialize("/");
    const { before_send } = init.mock.calls[0][1];
    const own = { properties: { $current_url: "https://example.com/dashboard" } };
    const client = { properties: { $current_url: "https://example.com/minha-pagina" } };
    expect(before_send(own)).toBe(own);
    expect(before_send(client)).toBeNull();
  });

  it("tira o token do link mágico da URL antes de enviar", async () => {
    await initialize("/login");
    const { before_send } = init.mock.calls[0][1];
    const event = {
      properties: {
        $current_url: "https://linkbio.dev.br/login/entrar?token=segredo-do-link",
        $referrer: "https://linkbio.dev.br/login/entrar?token=segredo-do-link",
      },
    };
    expect(before_send(event)).toBe(event);
    expect(event.properties.$current_url).toBe("https://linkbio.dev.br/login/entrar");
    expect(event.properties.$referrer).toBe("https://linkbio.dev.br/login/entrar");
    expect(JSON.stringify(event)).not.toContain("segredo-do-link");
  });
});
