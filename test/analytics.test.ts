import { describe, expect, it } from "vitest";
import { classifySource } from "@/server/analytics";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
const INSTAGRAM_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0";

describe("classifySource", () => {
  it("sem referrer é acesso direto", () => {
    expect(classifySource(null, CHROME, "linkbio.com.br")).toEqual({ source: "direto", host: null });
  });

  it("navegador interno do app vence o referrer", () => {
    expect(classifySource("https://www.google.com/", INSTAGRAM_APP, "linkbio.com.br").source).toBe("instagram");
    expect(classifySource(null, INSTAGRAM_APP, "linkbio.com.br").source).toBe("instagram");
  });

  it("reconhece redes pelo host do referrer, com ou sem www/subdomínio", () => {
    expect(classifySource("https://l.instagram.com/?u=x", CHROME, null)).toEqual({
      source: "instagram",
      host: "l.instagram.com",
    });
    expect(classifySource("https://www.google.com.br/", CHROME, null).source).toBe("google");
    expect(classifySource("https://t.co/abc", CHROME, null).source).toBe("x");
    expect(classifySource("https://wa.me/", CHROME, null).source).toBe("whatsapp");
  });

  it("não confunde domínios parecidos", () => {
    expect(classifySource("https://notinstagram.com/", CHROME, null).source).toBe("outros");
  });

  it("referrer do próprio site conta como direto", () => {
    expect(classifySource("https://www.linkbio.com.br/outra", CHROME, "linkbio.com.br")).toEqual({
      source: "direto",
      host: null,
    });
  });

  it("outros sites e referrer inválido", () => {
    expect(classifySource("https://blog.exemplo.com/post", CHROME, null)).toEqual({
      source: "outros",
      host: "blog.exemplo.com",
    });
    expect(classifySource("não é url", CHROME, null).source).toBe("direto");
  });
});
