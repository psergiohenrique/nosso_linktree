import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppearanceEditor from "@/components/AppearanceEditor";
import type { PageViewProfile } from "@/components/PageView";
import { SOCIAL_NETWORKS, THEME_PRESETS, WHATSAPP_DEFAULT, type SocialLinks } from "@/lib/types";

vi.mock("posthog-js", () => ({ default: {} }));

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
const socialLinks = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, { url: "", is_active: false }])) as SocialLinks;

function render(pro: boolean) {
  return renderToStaticMarkup(
    <AppearanceEditor
      profile={profile}
      links={[]}
      pro={pro}
      action={async () => {}}
      slugAction={async () => {}}
      version="v1"
      socialPosition="below_name"
      socialLinks={socialLinks}
    />,
  );
}

/** O `<details>` da seção com esse título. */
function section(html: string, title: string) {
  const start = html.lastIndexOf("<details", html.indexOf(title));
  return html.slice(start, html.indexOf("</summary>", start));
}

describe("seção do selo no editor de aparência", () => {
  it("no Grátis vem aberta e com a etiqueta Pro, para convidar a assinar", () => {
    const html = section(render(false), "Selo");
    expect(html).toMatch(/^<details[^>]* open=""/);
    expect(html).toContain("pro-tag");
  });

  it("no Pro vem recolhida e sem etiqueta", () => {
    const html = section(render(true), "Selo");
    expect(html).not.toContain(' open=""');
    expect(html).not.toContain("pro-tag");
  });
});
