import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PageView, { type PageViewProfile } from "@/components/PageView";
import { THEME_PRESETS, WHATSAPP_DEFAULT } from "@/lib/types";

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

  it("não mostra nome ou slug como título quando o nome está vazio", () => {
    const html = render({ display_name: "  " });
    expect(html).not.toContain('class="bio-name"');
    expect(html).toContain('class="bio-initial">A');
  });
});
