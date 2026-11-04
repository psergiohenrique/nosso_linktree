import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getProfileByUser: vi.fn(), query: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/profiles", () => ({ getProfileByUser: mocks.getProfileByUser }));
vi.mock("@/server/db", () => ({ query: mocks.query }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(url); },
  notFound: () => { throw new Error("404"); },
}));
import { updateSocialLinks } from "@/app/dashboard/actions";
import { SOCIAL_NETWORKS } from "@/lib/types";

describe("action de redes sociais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner" });
    mocks.getProfileByUser.mockResolvedValue({ id: "owner", slug: "perfil" });
    mocks.query.mockResolvedValue(undefined);
  });

  it("salva redes normalizadas para o dono e invalida a página", async () => {
    const data = new FormData();
    data.set("social_position", "after_links");
    data.set("instagram_url", " instagram.com/ana ");
    data.set("instagram_is_active", "1");
    data.set("facebook_url", "https://facebook.com/ana");
    await expect(updateSocialLinks(data)).rejects.toThrow("?ok=1");
    expect(mocks.getProfileByUser).toHaveBeenCalledWith("owner");
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("where id = $1");
    expect(params.slice(0, 2)).toEqual(["owner", "after_links"]);
    const links = JSON.parse(params[2]);
    expect(Object.keys(links)).toEqual([...SOCIAL_NETWORKS]);
    expect(links.instagram).toEqual({ url: "https://instagram.com/ana", is_active: true });
    expect(links.facebook).toEqual({ url: "https://facebook.com/ana", is_active: false });
    expect(links.x).toEqual({ url: "", is_active: false });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/perfil");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("rejeita posição inválida, URL insegura ou rede ativa sem URL antes de gravar", async () => {
    const position = new FormData(); position.set("social_position", "invalid");
    const unsafe = new FormData(); unsafe.set("social_position", "below_name"); unsafe.set("instagram_url", "javascript:alert(1)");
    const empty = new FormData(); empty.set("social_position", "below_name"); empty.set("instagram_is_active", "1");
    const file = new FormData(); file.set("social_position", "below_name"); file.set("instagram_url", new Blob(["x"]), "url.txt");
    const wrongDomain = new FormData(); wrongDomain.set("social_position", "below_name"); wrongDomain.set("instagram_url", "https://facebook.com/ana");
    const spoofed = new FormData(); spoofed.set("social_position", "below_name"); spoofed.set("instagram_url", "https://instagram.com.evil.com/ana");
    for (const data of [position, unsafe, empty, file, wrongDomain, spoofed]) {
      await expect(updateSocialLinks(data)).rejects.toThrow("/dashboard/aparencia?error=");
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
