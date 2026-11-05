import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_LINKS, EXAMPLE_PROFILE } from "@/lib/playground";
import { EMPTY_SOCIAL_LINKS } from "@/lib/editor";

const mocks = vi.hoisted(() => ({ pro: true }));
vi.mock("posthog-js", () => ({ default: {} }));
// QR code é um Server Component assíncrono, fora do editor compartilhado.
vi.mock("@/components/ProfileQRCode", () => ({ default: () => <section>QR code</section> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ refresh() {} }) }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "owner", email: "test@example.com" }) }));
vi.mock("@/server/profiles", () => ({
  getProfileByUser: async () => ({ ...EXAMPLE_PROFILE, id: "owner", avatar_id: null, cover_image_id: null, search_indexing: true }),
  getLinksByProfile: async () => EXAMPLE_LINKS.map((link, position) => ({ ...link, profile_id: "owner", thumbnail_id: link.thumbnail_url ? "sample" : null, position })),
}));
vi.mock("@/server/billing", () => ({ getPlan: async () => ({ pro: mocks.pro }), billingEnabled: () => false }));
vi.mock("@/server/forms", () => ({ formsEnabled: async () => false }));
vi.mock("@/app/dashboard/actions", () => ({ addLink: async () => {}, updateLink: async () => {}, deleteLink: async () => {}, reorderLinks: async () => {}, createProfile: async () => {}, toggleSearchIndexing: async () => {} }));
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));

import LinksPage from "@/app/dashboard/page";
import DashboardLayout from "@/app/dashboard/layout";
import AppearanceEditor from "@/components/AppearanceEditor";
import AppearanceSections from "@/components/AppearanceSections";
import Playground from "@/components/Playground";

const noop = () => {};
const action = async () => {};
const sectionTitles = (html: string) => [...html.matchAll(/<h2 class="sec-title">(.*?)<\/h2>/g)].map((match) => match[1]);
const fields = (html: string) => [...new Set([...html.matchAll(/<(?:input|select|textarea)\b[^>]* name="([^"]+)"/g)].map((match) => match[1]))].sort();

describe("paridade dos editores reais", () => {
  beforeEach(() => { mocks.pro = true; });

  it("painel e demo renderizam os mesmos cartões recolhíveis, criação e campos de Links", async () => {
    const panel = renderToStaticMarkup(await LinksPage({ searchParams: Promise.resolve({}) }));
    const demo = renderToStaticMarkup(<Playground />);
    for (const html of [panel, demo]) {
      expect(html.match(/<details class="link-card /g)).toHaveLength(EXAMPLE_LINKS.length);
      expect(html).not.toMatch(/<details class="link-card [^"]*" open/);
      expect(html.match(/class="link-grip"/g)).toHaveLength(EXAMPLE_LINKS.length);
      expect(html).toContain('class="sheet"');
      expect(html).toContain('name="message"');
      expect(html).toContain('name="remove_thumbnail"');
      expect(html).toContain('name="is_active"');
    }
    // O painel também tem a preferência de indexação; o demo não oferece operações reais de conta.
    expect(fields(panel).filter((field) => field !== "on")).toEqual(fields(demo));
    expect(panel).toContain('data-posthog-event="link_created"');
    expect(demo).not.toContain("data-posthog-event");
    expect(demo).not.toContain("/go/");
    expect(demo).toContain("nada é salvo");
  });

  it("Aparência do painel contém toda a composição compartilhada usada pelo demo", () => {
    const shared = renderToStaticMarkup(<AppearanceSections state={EXAMPLE_PROFILE} setState={noop} pro branding={false} onBrandingChange={noop} avatarUrl={EXAMPLE_PROFILE.avatar_url} onAvatarFile={noop} onRemoveAvatar={noop} coverImageUrl={null} onCoverImageFile={noop} onRemoveCoverImage={noop} />);
    const panel = renderToStaticMarkup(<AppearanceEditor profile={EXAMPLE_PROFILE} links={EXAMPLE_LINKS} socialPosition="below_name" socialLinks={EMPTY_SOCIAL_LINKS} action={action} slugAction={action} version="v1" />);
    expect(sectionTitles(shared)).toEqual(["Perfil", "Redes sociais", "Tema e cores", "Botões", "Fonte", "Selo “Feito com Linkbio”"]);
    expect(sectionTitles(panel).filter((title) => title !== "Endereço da página")).toEqual(sectionTitles(shared));
    expect(fields(panel).filter((field) => !["slug", "remove_avatar", "remove_cover_image"].includes(field))).toEqual(fields(shared));
  });

  it("mantém limites e upsell no painel sem bloquear os recursos do demo", async () => {
    mocks.pro = false;
    const panel = renderToStaticMarkup(await LinksPage({ searchParams: Promise.resolve({}) }));
    expect(panel).toContain("Você chegou aos 5 links");
    expect(panel).toContain('class="locked"');
    expect(panel).toContain("Conhecer o Pro");
    const demo = renderToStaticMarkup(<Playground />);
    expect(demo).not.toContain('class="locked"');
    expect(demo).not.toContain("Você chegou aos");
  });

  it("usa os mesmos ícones e estrutura de navegação por rota ou seleção local", async () => {
    const panel = renderToStaticMarkup(await DashboardLayout({ children: <p>Conteúdo</p> }));
    const demo = renderToStaticMarkup(<Playground />);
    for (const html of [panel, demo]) {
      expect(html).toContain('class="dash-tabs dash-nav"');
      expect(html).toContain('class="dash-tab-icon"');
      expect(html).toContain('class="dash-top-actions"');
    }
    expect(panel).toContain('href="/dashboard/aparencia"');
    expect(demo).toContain('aria-pressed="true"');
    expect(demo).not.toContain('href="/dashboard/aparencia"');
  });
});
