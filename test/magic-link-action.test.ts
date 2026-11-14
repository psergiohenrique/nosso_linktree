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
  createPasswordReset: vi.fn(),
  /** Callbacks de after(): só rodam quando o teste manda, como o Next faz depois da resposta. */
  afterTasks: [] as Array<() => unknown>,
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.store }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    mocks.afterTasks.push(fn);
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
  createPasswordReset: mocks.createPasswordReset,
  createSession: mocks.createSession,
  destroySession: vi.fn(),
  findLoginLink: mocks.findLoginLink,
  getCurrentUser: vi.fn(),
  hashPassword: vi.fn(),
  RESET_COOKIE: "lb_reset",
  verifyPassword: mocks.verifyPassword,
}));

import { consumeMagicLink, requestMagicLink, requestPasswordReset, signIn } from "@/app/login/actions";
import { LOGIN_LINK_COOKIE, LOGIN_LINK_PATH } from "@/lib/login-link";
import { RATE_LIMIT_MESSAGE } from "@/server/rate-limit";

function form(email: string, password = "") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

/** Roda o que o Next rodaria depois de enviar a resposta. */
async function runAfter() {
  const tasks = mocks.afterTasks.splice(0);
  await Promise.all(tasks.map((task) => task()));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterTasks.length = 0;
  mocks.clientIp.mockResolvedValue("203.0.113.8");
  mocks.isRateLimited.mockResolvedValue(false);
  mocks.sendMail.mockResolvedValue(true);
  mocks.createSession.mockResolvedValue(undefined);
});

describe("pedido do link mágico", () => {
  it("responde igual para conta existente e inexistente, e só envia e-mail quando existe", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const missing = await requestMagicLink({}, form("Ninguem@Exemplo.com"));
    await runAfter();

    mocks.queryOne.mockResolvedValueOnce({ id: "user-1" });
    mocks.createLoginLink.mockResolvedValueOnce("tokentokentokentokentoken");
    const existing = await requestMagicLink({}, form("Ana@Exemplo.com"));
    await runAfter();

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

  it("a resposta não espera a busca da conta nem o envio: tudo roda no after()", async () => {
    mocks.queryOne.mockResolvedValue({ id: "user-1" });
    mocks.createLoginLink.mockResolvedValue("tokentokentokentokentoken");
    let finishMail!: () => void;
    mocks.sendMail.mockReturnValue(new Promise<boolean>((resolve) => (finishMail = () => resolve(true))));

    // Conta existente e inexistente devolvem sem ter consultado, criado link ou enviado nada.
    await requestMagicLink({}, form("ana@exemplo.com"));
    await requestMagicLink({}, form("ninguem@exemplo.com"));
    expect(mocks.afterTasks).toHaveLength(2);
    expect(mocks.queryOne).not.toHaveBeenCalled();
    expect(mocks.createLoginLink).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();

    const pending = runAfter();
    await vi.waitFor(() => expect(mocks.sendMail).toHaveBeenCalled());
    finishMail();
    await pending;
  });

  it("falha no envio não vira erro para quem pediu (nem revela que a conta existe)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.queryOne.mockResolvedValue({ id: "user-1" });
    mocks.createLoginLink.mockResolvedValue("tokentokentokentokentoken");
    mocks.sendMail.mockRejectedValue(new Error("resend fora do ar"));
    await expect(requestMagicLink({}, form("ana@exemplo.com"))).resolves.toMatchObject({ sent: true });
    await expect(runAfter()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
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
    // Cookie com path próprio só é apagado se o delete levar o mesmo path.
    expect(mocks.store.delete).toHaveBeenCalledWith({ name: LOGIN_LINK_COOKIE, path: LOGIN_LINK_PATH });
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    await runAfter();
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
    await runAfter();
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
    await runAfter();
    expect(mocks.captureAuthEvent).toHaveBeenCalledWith({
      event: "login_succeeded",
      distinctId: "user-1",
      method: "password",
    });
    expect(JSON.stringify(mocks.captureAuthEvent.mock.calls)).not.toContain("ana@exemplo.com");
  });
});

describe("login por senha em conta sem senha", () => {
  it("hash nulo (conta confirmada pelo link) recusa com a mesma mensagem de senha errada", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: "user-1", password_hash: null });
    mocks.verifyPassword.mockResolvedValueOnce(false);
    await expect(signIn(form("ana@exemplo.com", "senha-longa"))).rejects.toThrow("REDIRECT /login?error=");
    expect(mocks.verifyPassword).toHaveBeenCalledWith("senha-longa", null);
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.recordAttempt).toHaveBeenCalledWith("signin", expect.anything());
  });
});

describe("recuperação de senha", () => {
  it("busca, token e e-mail rodam no after(), igual para conta existente e inexistente", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: "user-1" });
    mocks.createPasswordReset.mockResolvedValueOnce("resettokenresettokenreset");
    await expect(requestPasswordReset(form("ana@exemplo.com"))).rejects.toThrow("REDIRECT /login/recuperar?enviado=1");
    expect(mocks.afterTasks).toHaveLength(1);
    expect(mocks.queryOne).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    await runAfter();
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0][0].text).toContain("/api/redefinir-senha?token=resettokenresettokenreset");

    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(requestPasswordReset(form("ninguem@exemplo.com"))).rejects.toThrow(
      "REDIRECT /login/recuperar?enviado=1",
    );
    expect(mocks.afterTasks).toHaveLength(1);
    await runAfter();
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });
});
