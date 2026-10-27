import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "@/lib/admin";

describe("ADMIN_EMAILS", () => {
  it("aceita vírgula, espaço e ponto e vírgula, sem diferenciar maiúsculas", () => {
    expect([...parseAdminEmails(" A@x.com, b@y.com;c@z.com\nd@w.com ")]).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
      "d@w.com",
    ]);
    expect(isAdminEmail("B@Y.com", "a@x.com,b@y.com")).toBe(true);
  });

  it("vazia ou ausente não libera ninguém", () => {
    expect(isAdminEmail("a@x.com", undefined)).toBe(false);
    expect(isAdminEmail("a@x.com", "")).toBe(false);
    expect(isAdminEmail("", ", ,")).toBe(false);
  });

  it("não aceita e-mail parcial", () => {
    expect(isAdminEmail("a@x.co", "a@x.com")).toBe(false);
    expect(isAdminEmail("xa@x.com", "a@x.com")).toBe(false);
  });
});
