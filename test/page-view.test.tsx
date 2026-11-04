import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PageView, { type PageViewProfile } from "@/components/PageView";
import { SOCIAL_NETWORKS, THEME_PRESETS, WHATSAPP_DEFAULT, type SocialLinks } from "@/lib/types";

const profile: PageViewProfile = {
  ...THEME_PRESETS[0].appearance,
  ...WHATSAPP_DEFAULT,
  slug: "ana",
  display_name: "Ana",
  bio: "",
  show_avatar: true,
  avatar_url: null,
  cover_image_url: null,
};

function render(patch: Partial<PageViewProfile>) {
  return renderToStaticMarkup(<PageView profile={{ ...profile, ...patch }} links={[]} branding={false} />);
}

describe("página pública", () => {
  it("mostra a inicial ou a foto quando o círculo está habilitado", () => {
    expect(render({})).toContain('class="bio-initial">A');
    expect(render({ avatar_url: "/foto.png" })).toContain('class="bio-avatar"');
  });

  it("oculta tanto a foto quanto a inicial quando o círculo está desabilitado", () => {
    for (const avatar_url of [null, "/foto.png"]) {
      const html = render({ show_avatar: false, avatar_url });
      expect(html).not.toContain('class="bio-initial"');
      expect(html).not.toContain('class="bio-avatar"');
    }
  });

  it("renderiza as redes ativas com rótulos acessíveis e links seguros", () => {
    const hosts = { instagram: "instagram.com", facebook: "facebook.com", tiktok: "tiktok.com", youtube: "youtube.com", linkedin: "linkedin.com", x: "x.com" };
    const social_links = Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, { url: `https://${hosts[network]}/perfil`, is_active: true }])) as SocialLinks;
    const html = render({ social_links });
    for (const label of ["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "X"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('href="https://instagram.com/perfil" target="_blank" rel="noopener noreferrer nofollow ugc"');
    expect(html).toContain('aria-hidden="true"');
    social_links.instagram.is_active = false;
    social_links.facebook.url = "javascript:alert(1)";
    const filtered = render({ social_links });
    expect(filtered).not.toContain('aria-label="Instagram"');
    expect(filtered).not.toContain('aria-label="Facebook"');
    for (const network of SOCIAL_NETWORKS) social_links[network].is_active = false;
    expect(render({ social_links })).not.toContain('aria-label="Redes sociais"');
  });

  it("posiciona as redes antes ou depois dos links, inclusive na posição padrão", () => {
    const social_links = Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, { url: "https://instagram.com/ana", is_active: network === "instagram" }])) as SocialLinks;
    for (const position of [undefined, "below_name", "after_links"] as const) {
      const html = render({ social_links, social_position: position });
      const header = html.indexOf('</header>');
      const social = html.indexOf('aria-label="Redes sociais"');
      const links = html.indexOf('aria-label="Links"');
      expect(header).toBeGreaterThan(-1);
      expect(social).toBeGreaterThan(header);
      expect(links).toBeGreaterThan(-1);
      expect(position === "after_links" ? social > links : social < links).toBe(true);
    }
  });

  it("não mostra nome ou slug como título quando o nome está vazio", () => {
    const html = render({ display_name: "  " });
    expect(html).not.toContain('class="bio-name"');
    expect(html).toContain('class="bio-initial">A');
  });
});
