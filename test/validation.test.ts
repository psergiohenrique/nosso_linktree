import { describe, expect, it } from "vitest";
import { oneOf, safeUrl, validateSlug, validColor, whatsappUrl } from "@/lib/validation";

describe("validateSlug", () => {
  it("normaliza e aceita 3–30 caracteres a-z0-9-", () => {
    expect(validateSlug("  Barbearia-Do-Ze ")).toBe("barbearia-do-ze");
    expect(validateSlug("abc")).toBe("abc");
    expect(validateSlug("a".repeat(30))).toBe("a".repeat(30));
  });

  it("recusa tamanho errado e caracteres inválidos", () => {
    expect(validateSlug("ab")).toBeNull();
    expect(validateSlug("a".repeat(31))).toBeNull();
    expect(validateSlug("meu_slug")).toBeNull();
    expect(validateSlug("café")).toBeNull();
    expect(validateSlug("com espaço")).toBeNull();
  });

  it("recusa slugs reservados (rotas do app)", () => {
    for (const slug of ["login", "dashboard", "go", "api", "media", "demo", "admin"]) {
      expect(validateSlug(slug)).toBeNull();
    }
    expect(validateSlug("LOGIN")).toBeNull();
  });
});

describe("safeUrl", () => {
  it("aceita http, https, tel e mailto", () => {
    expect(safeUrl("https://exemplo.com/a?b=1")).toBe("https://exemplo.com/a?b=1");
    expect(safeUrl("http://exemplo.com")).toBe("http://exemplo.com/");
    expect(safeUrl("tel:+5511999999999")).toBe("tel:+5511999999999");
    expect(safeUrl("mailto:oi@exemplo.com")).toBe("mailto:oi@exemplo.com");
  });

  it("completa https:// quando falta o protocolo", () => {
    expect(safeUrl("exemplo.com.br/cardapio")).toBe("https://exemplo.com.br/cardapio");
  });

  it("recusa protocolos perigosos e valores vazios", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
    expect(safeUrl("   ")).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("adiciona o DDI 55 a números brasileiros com DDD", () => {
    expect(whatsappUrl("(11) 98765-4321", "")).toBe("https://wa.me/5511987654321");
    expect(whatsappUrl("11 3456-7890", "")).toBe("https://wa.me/551134567890");
  });

  it("mantém número com DDI e codifica a mensagem", () => {
    expect(whatsappUrl("+55 11 98765-4321", " Olá, quero agendar & saber preço ")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20quero%20agendar%20%26%20saber%20pre%C3%A7o",
    );
  });

  it("recusa números curtos ou longos demais", () => {
    expect(whatsappUrl("98765-4321", "")).toBeNull();
    expect(whatsappUrl("1".repeat(16), "")).toBeNull();
  });
});

describe("validColor", () => {
  it("aceita #rrggbb e normaliza para minúsculas", () => {
    expect(validColor(" #A1B2C3 ", "#000000")).toBe("#a1b2c3");
  });

  it("usa o padrão para valores inválidos", () => {
    expect(validColor("#abc", "#000000")).toBe("#000000");
    expect(validColor("red", "#000000")).toBe("#000000");
    expect(validColor("#123456; background:url(x)", "#000000")).toBe("#000000");
    expect(validColor(null, "#ffffff")).toBe("#ffffff");
  });
});

describe("oneOf", () => {
  it("só aceita valores da lista", () => {
    expect(oneOf("pill", ["rounded", "pill"] as const, "rounded")).toBe("pill");
    expect(oneOf("hack", ["rounded", "pill"] as const, "rounded")).toBe("rounded");
    expect(oneOf(undefined, ["rounded", "pill"] as const, "rounded")).toBe("rounded");
  });
});
