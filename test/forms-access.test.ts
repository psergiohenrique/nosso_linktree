import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), setFormsEnabled: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn((url: string): never => { throw new Error(`redirect:${url}`); }),
}));
vi.mock("@/server/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/forms", () => ({ setFormsEnabled: mocks.setFormsEnabled }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { adminSetFormsEnabled } from "@/app/admin/actions";

const id = "11111111-1111-4111-8111-111111111111";
function data(enabled: string) {
  const d = new FormData();
  d.set("user_id", id);
  d.set("enabled", enabled);
  return d;
}

describe("admin: acesso a formulários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ email: "admin@example.test" });
    mocks.setFormsEnabled.mockResolvedValue(true);
  });

  it("exige admin antes de qualquer alteração", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("not found"));
    await expect(adminSetFormsEnabled(data("1"))).rejects.toThrow("not found");
    expect(mocks.setFormsEnabled).not.toHaveBeenCalled();
  });

  it.each([["1", true], ["0", false]] as const)("altera explicitamente %s", async (value, enabled) => {
    await expect(adminSetFormsEnabled(data(value))).rejects.toThrow("redirect:");
    expect(mocks.setFormsEnabled).toHaveBeenCalledWith(id, enabled);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("rejeita estado inválido sem alterar a conta", async () => {
    await expect(adminSetFormsEnabled(data("sim"))).rejects.toThrow("redirect:");
    expect(mocks.setFormsEnabled).not.toHaveBeenCalled();
  });
});
