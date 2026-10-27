import { describe, expect, it } from "vitest";
import {
  isIndexable,
  jsonLdString,
  profileDescription,
  profileJsonLd,
  profileTitle,
  socialProfiles,
  truncate,
} from "@/lib/seo";

const profile = (patch: Partial<{ slug: string; display_name: string; bio: string; search_indexing: boolean }> = {}) => ({
  slug: "barbearia-do-ze",
  display_name: "Barbearia do Zé",
  bio: "",
  search_indexing: true,
  ...patch,
});

describe("isIndexable", () => {
  it("precisa de nome ou bio e de pelo menos um link ativo", () => {
    expect(isIndexable(profile(), 1)).toBe(true);
    expect(isIndexable(profile({ display_name: "", bio: "Cortes e barba" }), 3)).toBe(true);
    expect(isIndexable(profile(), 0)).toBe(false);
    expect(isIndexable(profile({ display_name: "  ", bio: "" }), 2)).toBe(false);
  });

  it("respeita a opção desligada", () => {
    expect(isIndexable(profile({ search_indexing: false }), 5)).toBe(false);
  });
});

describe("título e descrição", () => {
  it("título com nome e @slug; sem nome, só o @slug", () => {
    expect(profileTitle(profile())).toBe("Barbearia do Zé (@barbearia-do-ze)");
    expect(profileTitle(profile({ display_name: "" }))).toBe("@barbearia-do-ze");
  });

  it("usa a bio quando existe, cortada em 160", () => {
    expect(profileDescription(profile({ bio: "Cortes e barba no centro." }), ["Agendar"])).toBe(
      "Cortes e barba no centro.",
    );
    const long = profileDescription(profile({ bio: "palavra ".repeat(60) }), []);
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith("…")).toBe(true);
  });

  it("sem bio, monta com os primeiros links", () => {
    expect(profileDescription(profile(), ["Agendar", "Instagram", "Cardápio"])).toBe(
      "Links de Barbearia do Zé: Agendar, Instagram e Cardápio.",
    );
    expect(profileDescription(profile(), ["Agendar"])).toBe("Links de Barbearia do Zé: Agendar.");
    expect(profileDescription(profile({ display_name: "" }), [])).toBe("Links de @barbearia-do-ze.");
  });

  it("truncate não quebra palavra", () => {
    expect(truncate("um dois três quatro", 12)).toBe("um dois…");
    expect(truncate("curto", 12)).toBe("curto");
  });
});

describe("socialProfiles", () => {
  it("pega só perfis de redes, sem repetir e sem a raiz da rede", () => {
    expect(
      socialProfiles([
        "https://www.instagram.com/barbeariadoze/",
        "https://instagram.com/barbeariadoze",
        "https://m.facebook.com/barbeariadoze",
        "https://www.tiktok.com/@barbeariadoze?lang=pt",
        "https://instagram.com/",
        "https://agenda.exemplo.com/ze",
        "https://notinstagram.com/x",
        "javascript:alert(1)",
        "não é url",
      ]),
    ).toEqual([
      "https://instagram.com/barbeariadoze",
      "https://facebook.com/barbeariadoze",
      "https://tiktok.com/@barbeariadoze",
    ]);
  });
});

describe("JSON-LD da página", () => {
  it("ProfilePage com a entidade, foto absoluta e sameAs", () => {
    const ld = profileJsonLd(
      { ...profile({ bio: "Cortes" }), updated_at: new Date("2026-10-27T12:00:00Z") },
      { avatarUrl: "/media/abc", linkUrls: ["https://instagram.com/ze"] },
    );
    expect(ld["@type"]).toBe("ProfilePage");
    expect(ld.url).toMatch(/\/barbearia-do-ze$/);
    expect(ld.mainEntity).toMatchObject({
      "@type": "Organization",
      name: "Barbearia do Zé",
      description: "Cortes",
      sameAs: ["https://instagram.com/ze"],
    });
    expect(ld.mainEntity.image).toMatch(/^https?:\/\/.+\/media\/abc$/);
  });

  it("texto do usuário não fecha a tag <script>", () => {
    const out = jsonLdString({ bio: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).bio).toBe("</script><script>alert(1)</script>");
  });
});
