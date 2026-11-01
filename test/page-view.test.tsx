import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PageView, { type PageViewProfile } from "@/components/PageView";
import { pixPayload } from "@/lib/pix";
import { pixQrSvg } from "@/lib/pix-qr";
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

  it("mostra o QR e o copia-e-cola do Pix, sem virar link", () => {
    const code = pixPayload({ key: "11144477735", merchantName: "Fulano de Tal", merchantCity: "Brasilia" });
    expect(code).toBeTruthy();
    const html = renderToStaticMarkup(
      <PageView
        profile={profile}
        branding={false}
        links={[
          {
            id: "pix-1",
            title: "Pagar sinal",
            url: "11144477735",
            kind: "pix",
            layout: "button",
            size: "md",
            thumbnail_url: null,
            pixCode: code,
            pixSvg: pixQrSvg(code!),
          },
        ]}
      />,
    );
    expect(html).toContain("Pagar sinal");
    expect(html).toContain("Copiar código");
    expect(html).toContain(code!);
    expect(html).toContain("<svg");
    expect(html).not.toContain('href="/go/pix-1"');
  });

  it("não mostra nome ou slug como título quando o nome está vazio", () => {
    const html = render({ display_name: "  " });
    expect(html).not.toContain('class="bio-name"');
    expect(html).toContain('class="bio-initial">A');
  });
});
