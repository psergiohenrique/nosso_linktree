// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppearanceEditor from "@/components/AppearanceEditor";
import Playground from "@/components/Playground";
import { EMPTY_SOCIAL_LINKS } from "@/lib/editor";
import { EXAMPLE_LINKS, EXAMPLE_PROFILE } from "@/lib/playground";

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

let container: HTMLDivElement;
let root: Root;
const createUrl = vi.fn();
const revokeUrl = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  let sequence = 0;
  createUrl.mockReset().mockImplementation(() => `blob:test-${++sequence}`);
  revokeUrl.mockReset();
  Object.defineProperties(URL, { createObjectURL: { configurable: true, value: createUrl }, revokeObjectURL: { configurable: true, value: revokeUrl } });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; this.dispatchEvent(new Event("close")); } },
  });
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function element<T extends Element = HTMLElement>(selector: string) {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento ausente: ${selector}`);
  return found;
}
async function click(selector: string) {
  await act(async () => element<HTMLElement>(selector).click());
}
async function input(selector: string, value: string) {
  await act(async () => {
    const el = element<HTMLInputElement>(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function upload(selector: string) {
  await act(async () => {
    const el = element<HTMLInputElement>(selector);
    Object.defineProperty(el, "files", { configurable: true, value: [new File(["png"], "foto.png", { type: "image/png" })] });
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const sections = () => [...container.querySelectorAll(".sec-title")].map((el) => el.textContent);
const save = vi.fn<(data: FormData) => Promise<void>>(async () => {});
function panel(version = "v1") {
  return <AppearanceEditor profile={EXAMPLE_PROFILE} links={EXAMPLE_LINKS} socialPosition="below_name" socialLinks={EMPTY_SOCIAL_LINKS} action={save} slugAction={async () => {}} version={version} />;
}

describe("interações dos adaptadores reais", () => {
  it("trocar para Aparência no demo mostra exatamente as mesmas seções do painel", async () => {
    await act(async () => root.render(<Playground />));
    await click(".dash-nav button:nth-of-type(2)");
    const demoSections = sections();
    expect(demoSections).toHaveLength(6);
    expect(element<HTMLDetailsElement>(".sec").open).toBe(true);
    expect(element<HTMLDetailsElement>(".sec:nth-of-type(2)").open).toBe(false);
    await act(async () => root.render(panel()));
    expect(sections().filter((title) => title !== "Endereço da página")).toEqual(demoSections);
  });

  it("editar, reordenar e restaurar Links atualiza o demo sem enviar dados ao servidor", async () => {
    await act(async () => root.render(<Playground />));
    await input("#link-2-title", "Novo título");
    expect(container.querySelectorAll(".link-sum-title")[1].textContent).toBe("Novo título");
    expect(container.querySelectorAll(".bio-link")[1].textContent).toBe("Novo título");
    await act(async () => element(".link-grip").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(element<HTMLElement>(".sortable-item").dataset.id).toBe("2");
    await click('[aria-label="Restaurar exemplo"]');
    expect(element<HTMLElement>(".sortable-item").dataset.id).toBe("1");
    expect(element<HTMLInputElement>("#link-2-title").value).toBe("Tabela de preços");
    expect(container.querySelector("[data-posthog-event]")).toBeNull();
  });

  it("mantém a ação de criação no rodapé, fora dos campos roláveis e sem mudar a habilitação", async () => {
    await act(async () => root.render(<Playground />));
    await click("[data-new-link]");
    const button = element<HTMLButtonElement>(".sheet-footer button");
    expect(button.textContent).toBe("Adicionar link");
    expect(button.form).toBe(element(".sheet-form"));
    expect(button.disabled).toBe(false);
    expect(element("#new-title").closest(".sheet-body")).not.toBeNull();
    expect(container.querySelector(".sheet-body .sheet-footer")).toBeNull();
    expect(container.querySelector(".sheet-footer input")).toBeNull();
  });

  it("criar e excluir links usa o mesmo diálogo e mantém tudo em memória", async () => {
    await act(async () => root.render(<Playground />));
    await click("[data-new-link]");
    expect(element<HTMLDialogElement>(".sheet").open).toBe(true);
    await input("#new-title", "Site de teste");
    await input("#new-url", "example.com/teste");
    await act(async () => element(".sheet-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.querySelectorAll(".link-card")).toHaveLength(6);
    expect(element<HTMLDialogElement>(".sheet").open).toBe(false);
    await click(".sortable-item:last-child .lf-delete button");
    expect(element<HTMLDialogElement>(".confirm-dialog[open]").open).toBe(true);
    await act(async () => element(".confirm-dialog[open] form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.querySelectorAll(".link-card")).toHaveLength(5);
    // Remontar simula recarregar: nenhuma edição ficou persistida.
    await act(async () => root.render(null));
    await act(async () => root.render(<Playground />));
    expect(container.querySelectorAll(".link-card")).toHaveLength(5);
  });

  it("imagens locais são liberadas ao trocar, remover, restaurar e desmontar", async () => {
    await act(async () => root.render(<Playground />));
    await upload(".link-card [type=file]");
    expect(element<HTMLImageElement>(".link-card .link-thumb").src).toBe("blob:test-1");
    await upload(".link-card [type=file]");
    expect(revokeUrl).toHaveBeenCalledWith("blob:test-1");
    await click(".link-card [name=remove_thumbnail]");
    expect(revokeUrl).toHaveBeenCalledWith("blob:test-2");
    await click(".dash-nav button:nth-of-type(2)");
    await upload("[name=avatar]");
    await upload("[name=cover_image]");
    await click('[aria-label="Restaurar exemplo"]');
    expect(revokeUrl).toHaveBeenCalledWith("blob:test-3");
    expect(revokeUrl).toHaveBeenCalledWith("blob:test-4");
    await upload("[name=avatar]");
    await act(async () => root.render(null));
    expect(revokeUrl).toHaveBeenCalledWith("blob:test-5");
  });

  it("perfil e redes do demo atualizam a prévia e são restaurados juntos", async () => {
    await act(async () => root.render(<Playground />));
    await click(".dash-nav button:nth-of-type(2)");
    await input("#profile-name", "Nome local");
    await input("#social-instagram", "https://instagram.com/exemplo");
    await click("[name=instagram_is_active]");
    expect(element(".bio-name").textContent).toBe("Nome local");
    expect(element<HTMLAnchorElement>(".bio-social a").href).toBe("https://instagram.com/exemplo");
    await click('[aria-label="Restaurar exemplo"]');
    expect(element<HTMLInputElement>("#profile-name").value).toBe(EXAMPLE_PROFILE.display_name);
    expect(container.querySelector(".bio-social")).toBeNull();
  });

  it("painel preserva Não salvo/Descartar e envia aparência e redes pela action", async () => {
    save.mockClear();
    await act(async () => root.render(panel()));
    expect(container.querySelector(".save-bar-dock")).toBeNull();
    await input("#profile-name", "Alteração");
    await input("#social-instagram", "https://instagram.com/exemplo");
    expect(container.querySelector(".save-bar-dock")).not.toBeNull();
    await click(".dock-discard");
    expect(element<HTMLInputElement>("#profile-name").value).toBe(EXAMPLE_PROFILE.display_name);
    expect(element<HTMLInputElement>("#social-instagram").value).toBe("");
    expect(container.querySelector(".save-bar-dock")).toBeNull();
    await input("#profile-name", "Nome salvo");
    await input("#social-instagram", "https://instagram.com/novo");
    await act(async () => element("form[data-posthog-event]").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].get("display_name")).toBe("Nome salvo");
    expect(save.mock.calls[0][0].get("instagram_url")).toBe("https://instagram.com/novo");
    await act(async () => root.render(panel("v2")));
    expect(container.querySelector(".save-bar-dock")).toBeNull();
  });
});
