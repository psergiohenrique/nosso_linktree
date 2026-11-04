import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), formsEnabled: vi.fn(), getOwnedForm: vi.fn(), deleteOwnedForm: vi.fn(), updateBuilderForm: vi.fn(),
  getProfileByUser: vi.fn(), getLinksByProfile: vi.fn(), addLink: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/forms", () => ({ ...mocks }));
vi.mock("@/server/profiles", () => ({ getProfileByUser: mocks.getProfileByUser, getLinksByProfile: mocks.getLinksByProfile }));
vi.mock("@/app/dashboard/actions", () => ({ addLink: mocks.addLink }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("404"); },
  redirect: (url: string) => { throw new Error(url); },
}));
import { addFormLink, removeForm, saveForm } from "@/app/dashboard/formularios/actions";
import { SITE_URL } from "@/lib/site";
import { defaultFields } from "@/lib/form-fields";

describe("gerenciamento de formulários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner" });
    mocks.formsEnabled.mockResolvedValue(true);
    mocks.getProfileByUser.mockResolvedValue({ id: "owner", slug: "perfil" });
    mocks.getLinksByProfile.mockResolvedValue([]);
    mocks.getOwnedForm.mockResolvedValue({ id: "form", fields: [], slug: "contato", title: "Contato", is_published: true });
    mocks.deleteOwnedForm.mockResolvedValue(true);
  });
  it("exige confirmação e dono antes de excluir", async () => {
    const data = new FormData(); data.set("id", "form");
    await expect(removeForm(data)).rejects.toThrow("Confirme");
    expect(mocks.deleteOwnedForm).not.toHaveBeenCalled();
    data.set("confirm", "on");
    mocks.getOwnedForm.mockResolvedValueOnce(null);
    await expect(removeForm(data)).rejects.toThrow("404");
    expect(mocks.deleteOwnedForm).not.toHaveBeenCalled();
    await expect(removeForm(data)).rejects.toThrow("formExcluido=1");
    expect(mocks.deleteOwnedForm).toHaveBeenCalledWith("owner", "form");
  });
  it("não duplica um link existente, mesmo inativo", async () => {
    const data = new FormData(); data.set("id", "form");
    mocks.getLinksByProfile.mockResolvedValue([{ url: `${SITE_URL}/perfil/f/contato`, is_active: false }]);
    await expect(addFormLink(data)).rejects.toThrow("error=");
    expect(mocks.getLinksByProfile).toHaveBeenCalledWith("owner");
    expect(mocks.addLink).not.toHaveBeenCalled();
  });
  it("impede exclusão, mudança de endereço e despublicação quando há link", async () => {
    mocks.getLinksByProfile.mockResolvedValue([{ url: `${SITE_URL}/perfil/f/contato`, is_active: true }]);
    const remove = new FormData(); remove.set("id", "form"); remove.set("confirm", "on");
    await expect(removeForm(remove)).rejects.toThrow("error=");
    expect(mocks.deleteOwnedForm).not.toHaveBeenCalled();
    const data = new FormData();
    data.set("name", "Contato"); data.set("title", "Contato"); data.set("slug", "novo");
    data.set("fields", JSON.stringify(defaultFields())); data.set("isPublished", "on");
    expect(await saveForm("form", {}, data)).toHaveProperty("error");
    data.set("slug", "contato"); data.delete("isPublished");
    expect(await saveForm("form", {}, data)).toHaveProperty("error");
    expect(mocks.updateBuilderForm).not.toHaveBeenCalled();
  });
  it("não altera formulários externos e só adiciona publicados do dono", async () => {
    const data = new FormData(); data.set("id", "form"); data.set("confirm", "on");
    mocks.getOwnedForm.mockResolvedValueOnce({ fields: null });
    await expect(removeForm(data)).rejects.toThrow("404");
    mocks.getOwnedForm.mockResolvedValueOnce({ fields: [], is_published: false });
    await expect(addFormLink(data)).rejects.toThrow("404");
    expect(mocks.addLink).not.toHaveBeenCalled();
    await expect(addFormLink(data)).rejects.toThrow("linkAdicionado=1");
    const link = mocks.addLink.mock.calls[0][0] as FormData;
    expect(link.get("url")).toContain("/perfil/f/contato");
    expect(link.get("title")).toBe("Contato");
  });
});
