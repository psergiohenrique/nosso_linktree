import { afterEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(key: string, options: unknown) { createClient(key, options); }
    captureExceptionImmediate = capture;
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("erros de servidor no PostHog", () => {
  it("envia apenas contexto sanitizado, sem mensagem ou stack originais", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "test-token");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.example");
    const { captureServerError } = await import("@/server/posthog-errors");
    await captureServerError("12345", "render");
    expect(createClient).toHaveBeenCalledWith("test-token", expect.objectContaining({ host: "https://posthog.example" }));
    expect(capture).toHaveBeenCalledOnce();
    const [error, id, properties] = capture.mock.calls[0];
    expect(error.message).toBe("Erro não tratado no servidor (12345)");
    expect(error.stack).toBeUndefined();
    expect(id).toBeUndefined();
    expect(properties).toEqual({ source: "nextjs_server", route_type: "render", digest: "12345", $geoip_disable: true });
  });

  it("descarta digest e tipo de rota inesperados", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "test-token");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.example");
    const { captureServerError } = await import("@/server/posthog-errors");
    await captureServerError("dados-privados", "/rota-privada");
    const [error, , properties] = capture.mock.calls[0];
    expect(error.message).toBe("Erro não tratado no servidor");
    expect(properties).toEqual({ source: "nextjs_server", route_type: "other", $geoip_disable: true });
  });

  it("não propaga falhas de envio", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "test-token");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.example");
    capture.mockRejectedValueOnce(new Error("detalhes privados"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServerError } = await import("@/server/posthog-errors");
    await expect(captureServerError(undefined, "action")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[posthog] falha ao enviar erro do servidor");
    log.mockRestore();
  });

  it("não envia sem configuração", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    const { captureServerError } = await import("@/server/posthog-errors");
    await captureServerError("123", "route");
    expect(capture).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
