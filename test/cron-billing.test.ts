import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  billingEnabled: vi.fn(),
  processPending: vi.fn(),
  expireOverdue: vi.fn(),
  purgeExpiredLoginLinks: vi.fn(),
}));

vi.mock("@/server/billing", () => ({
  billingEnabled: mocks.billingEnabled,
  processPending: mocks.processPending,
  expireOverdue: mocks.expireOverdue,
}));
vi.mock("@/server/auth", () => ({ purgeExpiredLoginLinks: mocks.purgeExpiredLoginLinks }));

import { GET } from "@/app/api/cron/billing/route";

const request = () =>
  new NextRequest("https://linkbio.dev.br/api/cron/billing", { headers: { authorization: "Bearer segredo-cron" } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "segredo-cron";
  mocks.billingEnabled.mockReturnValue(true);
  mocks.processPending.mockResolvedValue(2);
  mocks.expireOverdue.mockResolvedValue(1);
  mocks.purgeExpiredLoginLinks.mockResolvedValue(3);
});

describe("cron de cobrança", () => {
  it("rejeita sem o segredo", async () => {
    const res = await GET(new NextRequest("https://linkbio.dev.br/api/cron/billing"));
    expect(res.status).toBe(401);
    expect(mocks.processPending).not.toHaveBeenCalled();
  });

  it("processa a cobrança e limpa os links vencidos", async () => {
    const res = await GET(request());
    expect(await res.json()).toEqual({ processed: 2, expired: 1, purged: 3 });
  });

  it("falha na limpeza dos links não impede processPending nem expireOverdue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.purgeExpiredLoginLinks.mockRejectedValue(new Error("banco indisponível"));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(mocks.processPending).toHaveBeenCalledWith(100);
    expect(mocks.expireOverdue).toHaveBeenCalled();
    expect(await res.json()).toEqual({ processed: 2, expired: 1, purged: null });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("com a cobrança desligada, falha na limpeza ainda responde", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.billingEnabled.mockReturnValue(false);
    mocks.purgeExpiredLoginLinks.mockRejectedValue(new Error("x"));
    const res = await GET(request());
    expect(await res.json()).toEqual({ skipped: "billing desligado", purged: null });
    error.mockRestore();
  });
});
