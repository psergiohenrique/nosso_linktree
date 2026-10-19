import { describe, expect, it } from "vitest";
import { classifySource, geoFromHeaders, parseUtm } from "@/server/analytics";
import { bioEventPayload } from "@/server/posthog-events";

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

describe("parseUtm", () => {
  it("normaliza e limita os valores", () => {
    expect(parseUtm({ source: "  Instagram ", medium: "Stories  Pagos", campaign: "x".repeat(80) })).toEqual({
      source: "instagram",
      medium: "stories pagos",
      campaign: "x".repeat(60),
    });
  });

  it("ignora o que não é texto", () => {
    expect(parseUtm(null)).toEqual({ source: null, medium: null, campaign: null });
    expect(parseUtm({ source: 1, medium: "", campaign: ["a"] })).toEqual({ source: null, medium: null, campaign: null });
  });
});

describe("geoFromHeaders", () => {
  it("lê e decodifica os cabeçalhos da Vercel", () => {
    const h = new Headers({
      "x-vercel-ip-city": "S%C3%A3o%20Paulo",
      "x-vercel-ip-country-region": "sp",
      "x-vercel-ip-country": "BR",
    });
    expect(geoFromHeaders(h)).toEqual({ city: "São Paulo", region: "SP", country: "BR" });
  });

  it("sem cabeçalhos ou com valor inválido fica vazio", () => {
    expect(geoFromHeaders(new Headers())).toEqual({ city: null, region: null, country: null });
    expect(geoFromHeaders(new Headers({ "x-vercel-ip-country": "1x", "x-vercel-ip-city": "%E0%A4%A" })).country).toBeNull();
  });
});

describe("bioEventPayload", () => {
  const event = {
    source: "instagram",
    device: "mobile",
    city: "Recife",
    region: "PE",
    country: "BR",
    utm_source: null,
    utm_medium: null,
    utm_campaign: "promo",
  };

  it("visualização vai para o dono da página, sem GeoIP do servidor", () => {
    const p = bioEventPayload({ profileId: "perfil-1", event });
    expect(p).toMatchObject({ event: "bio_page_viewed", distinct_id: "perfil-1" });
    expect(p.properties).toMatchObject({ $geoip_disable: true, source: "instagram", city: "Recife", utm_campaign: "promo" });
    expect(p.properties).not.toHaveProperty("link_id");
  });

  it("clique leva o link e o tipo", () => {
    const p = bioEventPayload({ profileId: "perfil-1", event, link: { id: "link-1", kind: "whatsapp" } });
    expect(p.event).toBe("bio_link_clicked");
    expect(p.properties).toMatchObject({ link_id: "link-1", link_kind: "whatsapp" });
  });
});
