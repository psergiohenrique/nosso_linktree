import { describe, expect, it } from "vitest";
import { visibleSocialLinks } from "@/lib/social";
import { SOCIAL_NETWORKS, type SocialLinks } from "@/lib/types";
import { socialUrl } from "@/lib/validation";

describe("URLs de redes sociais", () => {
  it("normaliza URLs HTTP(S), inclusive sem protocolo", () => {
    expect(socialUrl(" instagram.com/ana ", "instagram")).toBe("https://instagram.com/ana");
    expect(socialUrl("http://m.facebook.com/ana", "facebook")).toBe("http://m.facebook.com/ana");
  });

  it("aceita somente domínios genuínos da rede correspondente", () => {
    const hosts = { instagram: "instagram.com", facebook: "facebook.com", tiktok: "tiktok.com", youtube: "youtu.be", linkedin: "linkedin.com", x: "twitter.com" } as const;
    for (const network of SOCIAL_NETWORKS) {
      expect(socialUrl(`https://www.${hosts[network]}/perfil`, network)).not.toBeNull();
      for (const host of ["example.com", `${hosts[network]}.evil.com`, `evil${hosts[network]}`, "instagram.com@evil.com"]) {
        expect(socialUrl(`https://${host}/perfil`, network)).toBeNull();
      }
    }
    expect(socialUrl("https://facebook.com/perfil", "instagram")).toBeNull();
  });

  it("recusa protocolos inseguros, credenciais, URLs inválidas e longas", () => {
    for (const url of ["", "javascript:alert(1)", "mailto:a@example.com", "tel:123", "https://user:pass@example.com", "https://user@example.com", "https://", `https://example.com/${"a".repeat(2048)}`]) {
      expect(socialUrl(url, "instagram")).toBeNull();
    }
  });
});

describe("redes sociais visíveis", () => {
  it("seleciona apenas ativas com URL segura, na ordem das redes suportadas", () => {
    const links = {
      instagram: { url: "instagram.com/ana", is_active: true },
      facebook: { url: "https://facebook.com/ana", is_active: false },
      tiktok: { url: "javascript:alert(1)", is_active: true },
      youtube: { url: "", is_active: true },
      linkedin: { url: "https://user@linkedin.com/ana", is_active: true },
      x: { url: "https://x.com/ana", is_active: true },
    } satisfies SocialLinks;
    expect(visibleSocialLinks(links)).toEqual([
      { network: "instagram", url: "https://instagram.com/ana" },
      { network: "x", url: "https://x.com/ana" },
    ]);
    expect(visibleSocialLinks(null)).toEqual([]);
  });

  it("aceita todas as redes suportadas", () => {
    const hosts = { instagram: "instagram.com", facebook: "facebook.com", tiktok: "tiktok.com", youtube: "youtube.com", linkedin: "linkedin.com", x: "x.com" };
    const links = Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, { url: `https://${hosts[network]}/perfil`, is_active: true }])) as SocialLinks;
    expect(visibleSocialLinks(links).map(({ network }) => network)).toEqual([...SOCIAL_NETWORKS]);
  });
});
