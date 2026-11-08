import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProfileChecklist from "@/components/ProfileChecklist";
import { profileChecklist } from "@/lib/profile-checklist";

const empty = { avatar_id: null, bio: "", cover_image_id: null };
const full = { avatar_id: "a", bio: "Arquiteta de interiores", cover_image_id: "c" };
const whats = { kind: "whatsapp" as const, is_active: true };

describe("profileChecklist", () => {
  it("página vazia: nenhum passo feito", () => {
    expect(profileChecklist(empty, []).map((i) => i.done)).toEqual([false, false, false, false]);
  });

  it("bio só com espaços não conta", () => {
    expect(profileChecklist({ ...empty, bio: "   \n " }, []).find((i) => i.id === "bio")?.done).toBe(false);
  });

  it("WhatsApp só conta se for do tipo whatsapp e estiver ativo", () => {
    const done = (links: Parameters<typeof profileChecklist>[1]) => profileChecklist(full, links).find((i) => i.id === "whatsapp")?.done;
    expect(done([{ kind: "link", is_active: true }])).toBe(false);
    expect(done([{ kind: "whatsapp", is_active: false }])).toBe(false);
    expect(done([whats])).toBe(true);
  });

  it("tudo feito: todos concluídos", () => {
    expect(profileChecklist(full, [whats]).every((i) => i.done)).toBe(true);
  });
});

describe("ProfileChecklist", () => {
  it("mostra o progresso e as ações dos passos que faltam", () => {
    const html = renderToStaticMarkup(<ProfileChecklist items={profileChecklist({ ...full, bio: "" }, [])} />);
    expect(html).toContain("2 de 4");
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('href="/dashboard/aparencia"');
    expect(html).toContain("data-new-link");
    expect(html).toContain("Escrever bio");
    expect(html).not.toContain("Adicionar foto");
  });

  it("some quando está tudo feito", () => {
    expect(renderToStaticMarkup(<ProfileChecklist items={profileChecklist(full, [whats])} />)).toBe("");
  });
});
