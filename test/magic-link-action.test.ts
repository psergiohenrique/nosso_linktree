import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: { get: vi.fn(), delete: vi.fn(), set: vi.fn() },
  sendMail: vi.fn(),
  queryOne: vi.fn(),
  createLoginLink: vi.fn(),
  consumeLoginLink: vi.fn(),
  findLoginLink: vi.fn(),
  createSession: vi.fn(),
  isRateLimited: vi.fn(),
  recordAttempt: vi.fn(),
  clientIp: vi.fn(),
  clearAttempts: vi.fn(),
  verifyPassword: vi.fn(),
  captureAuthEvent: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.store }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/server/db", () => ({ query: vi.fn(), queryOne: mocks.queryOne }));
vi.mock("@/server/mail", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/server/posthog-events", () => ({ captureAuthEvent: mocks.captureAuthEvent }));
vi.mock("@/server/rate-limit", () => ({
  clearAttempts: mocks.clearAttempts,
  clientIp: mocks.clientIp,
  isRateLimited: mocks.isRateLimited,
  recordAttempt: mocks.recordAttempt,
  RATE_LIMIT_MESSAGE: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
}));
vi.mock("@/server/auth", () => ({
  confirmEmail: vi.fn(),
  consumePasswordReset: vi.fn(),
  consumeLoginLink: mocks.consumeLoginLink,
  createEmailVerification: vi.fn(),
  createLoginLink: mocks.createLoginLink,
  createPasswordReset: vi.fn(),
  createSession: mocks.createSession,
  destroySession: vi.fn(),
  findLoginLink: mocks.findLoginLink,
  getCurrentUser: vi.fn(),
  hashPassword: vi.fn(),
  RESET_COOKIE: "lb_reset",
  verifyPassword: mocks.verifyPassword,
}));

import { consumeMagicLink, requestMagicLink, signIn } from "@/app/login/actions";
import { LOGIN_LINK_COOKIE } from "@/lib/login-link";
import { RATE_LIMIT_MESSAGE } from "@/server/rate-limit";

function form(email: string, password = "") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientIp.mockResolvedValue("203.0.113.8");
  mocks.isRateLimited.mockResolvedValue(false);
  mocks.sendMail.mockResolvedValue(true);
  mocks.createSession.mockResolvedValue(undefined);
});

describe("pedido do link mágico", () => {
  it("responde igual para conta existente e inexistente, e só envia e-mail quando existe", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const missing = await requestMagicLink({}, form("Ninguem@Exemplo.com"));

    mocks.queryOne.mockResolvedValueOnce({ id: "user-1" });
    mocks.createLoginLink.mockResolvedValueOnce("tokentokentokentokentoken");
    const existing = await requestMagicLink({}, form("Ana@Exemplo.com"));

    expect(missing).toMatchObject({ sent: true, email: "ninguem@exemplo.com" });
    expect(existing).toMatchObject({ sent: true, email: "ana@exemplo.com" });
    expect(Object.keys(missing).sort()).toEqual(Object.keys(existing).sort());
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.createLoginLink).toHaveBeenCalledTimes(1);
    expect(mocks.recordAttempt).toHaveBeenCalledTimes(2);

    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("ana@exemplo.com");
    expect(mail.text).toContain("/login/entrar?token=tokentokentokentokentoken");
    expect(mail.text).toContain("15 minutos");
    expect(mail.text.toLowerCase()).toContain("ignore");
    expect(mail.subject).not.toContain("tokentokentokentokentoken");
    expect(mocks.captureAuthEvent).toHaveBeenCalledTimes(1);
    expect(mocks.captureAuthEvent).toHaveBeenCalledWith({ event: "magic_link_requested", distinctId: "user-1" });
    expect(JSON.stringify(mocks.captureAuthEvent.mock.calls)).not.toContain("ana@exemplo.com");
    expect(JSON.stringify(mocks.captureAuthEvent.mock.calls)).not.toContain("tokentokentokentokentoken");
  });

  it("o 4º pedido bloqueado devolve a mensagem de limite e não envia e-mail", async () => {
    mocks.isRateLimited.mockResolvedValueOnce(true);
    const limited = await requestMagicLink({}, form("ana@exemplo.com"));
    expect(limited.error).toBe(RATE_LIMIT_MESSAGE);
    expect(limited.sent).toBeUndefined();
    expect(mocks.recordAttempt).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});

describe("consumo do link mágico", () => {
  it("cria a sessão e não encerra as outras por esta action", async () => {
    mocks.store.get.mockReturnValue({ value: "tokentokentokentokentoken" });
    mocks.consumeLoginLink.mockResolvedValue("user-1");
    await expect(consumeMagicLink()).rejects.toThrow("REDIRECT /dashboard");
    expect(mocks.store.delete).toHaveBeenCalledWith(LOGIN_LINK_COOKIE);
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    expect(mocks.captureAuthEvent).toHaveBeenCalledWith({
      event: "magic_link_login_succeeded",
      distinctId: "user-1",
    });
  });

  it("link vencido não entra e registra o motivo", async () => {
    mocks.store.get.mockReturnValue({ value: "tokentokentokentokentoken" });
    mocks.consumeLoginLink.mockResolvedValue(null);
    mocks.findLoginLink.mockResolvedValue({ status: "expired", userId: "user-1" });
    await expect(consumeMagicLink()).rejects.toThrow("REDIRECT /login/entrar");
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.captureAuthEvent).toHaveBeenCalledWith({
      event: "magic_link_login_failed",
      distinctId: "user-1",
      reason: "expired",
    });
  });
});

describe("login por senha", () => {
  it("registra sucesso com método password, sem e-mail", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: "user-1", password_hash: "scrypt$x$y" });
    mocks.verifyPassword.mockResolvedValueOnce(true);
    await expect(signIn(form("ana@exemplo.com", "senha-longa"))).rejects.toThrow("REDIRECT /dashboard");
    expect(mocks.captureAuthEvent).toHaveBeenCalledWith({
      event: "login_succeeded",
      distinctId: "user-1",
      method: "password",
    });
    expect(JSON.stringify(mocks.captureAuthEvent.mock.calls)).not.toContain("ana@exemplo.com");
  });
});
