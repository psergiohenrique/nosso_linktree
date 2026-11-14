import { describe, expect, it } from "vitest";
import { LOGIN_LINK_MINUTES, maskEmail } from "@/lib/login-link";
import { authEventPayload, type AuthCapture } from "@/server/posthog-events";
import { RATE_RULES } from "@/server/rate-limit";

describe("e-mail mascarado", () => {
  it("mostra só a primeira letra e o domínio", () => {
    expect(maskEmail("maria@gmail.com")).toBe("m***@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
    expect(maskEmail("sem-arroba")).toBe("***");
    expect(maskEmail("@dominio.com")).toBe("***");
  });
});

describe("eventos de autenticação", () => {
  const samples: AuthCapture[] = [
    { event: "magic_link_requested", distinctId: "user-1" },
    { event: "magic_link_login_succeeded", distinctId: "user-1" },
    { event: "magic_link_login_failed", distinctId: "user-1", reason: "expired" },
    { event: "magic_link_login_failed", distinctId: "user-1", reason: "used" },
    { event: "magic_link_login_failed", distinctId: "", reason: "invalid" },
    { event: "login_succeeded", distinctId: "user-1", method: "password" },
  ];

  it("não leva e-mail nem token", () => {
    for (const sample of samples) {
      const payload = authEventPayload(sample, new Date("2026-10-31T12:00:00Z"));
      const json = JSON.stringify(payload);
      expect(json).not.toContain("@");
      expect(json).not.toContain("token=");
      expect(payload.properties).not.toHaveProperty("email");
      expect(payload.properties).not.toHaveProperty("token");
    }
  });

  it("login por senha marca o método, e token inválido não cria pessoa", () => {
    const password = authEventPayload(
      { event: "login_succeeded", distinctId: "user-1", method: "password" },
      new Date("2026-10-31T12:00:00Z"),
    );
    expect(password).toMatchObject({ event: "login_succeeded", distinct_id: "user-1" });
    expect(password.properties).toMatchObject({ method: "password", $geoip_disable: true });

    const invalid = authEventPayload(
      { event: "magic_link_login_failed", distinctId: "ana@exemplo.com", reason: "invalid" },
      new Date("2026-10-31T12:00:00Z"),
    );
    expect(invalid.distinct_id).toBe("magic-link");
    expect(invalid.properties).toMatchObject({ reason: "invalid", $process_person_profile: false });
    expect(JSON.stringify(invalid)).not.toContain("ana@exemplo.com");
  });

  it("o link vale 15 minutos e o limite é o da recuperação", () => {
    expect(LOGIN_LINK_MINUTES).toBe(15);
    expect(RATE_RULES.magic).toEqual(RATE_RULES.reset);
  });
});
