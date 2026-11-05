import { describe, expect, it } from "vitest";
import { EXAMPLE_LINKS, EXAMPLE_PROFILE, playgroundLinkDraft, readPlaygroundLink, reorderPlaygroundLinks } from "@/lib/playground";

function data(values: Record<string, string>) {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("adaptador local do playground", () => {
  it("normaliza URLs e os formatos/tamanhos dos formulários compartilhados", () => {
    expect(readPlaygroundLink(data({ title: "Site", url: "example.com", layout: "tile", size: "lg" }))).toEqual({ kind: "link", title: "Site", url: "https://example.com/", layout: "tile", size: "lg" });
    expect(readPlaygroundLink(data({ url: "example.com", layout: "inventado", size: "x" }))).toMatchObject({ layout: "button", size: "md" });
  });

  it("monta WhatsApp com DDI e mensagem", () => {
    expect(readPlaygroundLink(data({ kind: "whatsapp", url: "11 99999-9999", message: "Quero agendar" })).url).toBe("https://wa.me/5511999999999?text=Quero%20agendar");
  });

  it.each(["javascript:alert(1)", "data:text/html,oi", "", "https://example.com/" + "a".repeat(2048)])("não aceita destino inseguro/inválido: %s", (url) => {
    expect(readPlaygroundLink(data({ url })).url).toBeNull();
  });

  it("não aceita telefone inválido nem mensagem maior que o limite", () => {
    expect(readPlaygroundLink(data({ kind: "whatsapp", url: "123" })).url).toBeNull();
    expect(readPlaygroundLink(data({ kind: "whatsapp", url: "11999999999", message: "a".repeat(2048) })).url).toBeNull();
  });

  it("atualiza prévia sem mutar os exemplos e mantém a última URL válida ao digitar", () => {
    const original = structuredClone(EXAMPLE_LINKS[1]);
    const draft = playgroundLinkDraft(EXAMPLE_LINKS[1], data({ title: "Novo título", url: "javascript:alert(1)", layout: "button", size: "sm", remove_thumbnail: "on" }));
    expect(draft).toMatchObject({ title: "Novo título", url: original.url, is_active: false, thumbnail_url: null, layout: "button", size: "sm" });
    expect(EXAMPLE_LINKS[1]).toEqual(original);
  });

  it("reordena sem perder/duplicar links ou aceitar ids desconhecidos", () => {
    const original = EXAMPLE_LINKS.map((link) => link.id);
    expect(reorderPlaygroundLinks(EXAMPLE_LINKS, ["3", "3", "desconhecido", "1"]).map((link) => link.id)).toEqual(["3", "1", "2", "4", "5"]);
    expect(EXAMPLE_LINKS.map((link) => link.id)).toEqual(original);
  });

  it("o exemplo tem todas as redes, sem dados externos ou URLs blob persistidas", () => {
    expect(Object.keys(EXAMPLE_PROFILE.social_links!)).toHaveLength(6);
    expect(JSON.stringify({ EXAMPLE_PROFILE, EXAMPLE_LINKS })).not.toContain("blob:");
  });
});
