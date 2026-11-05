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
import { reorderLinks } from "@/app/dashboard/actions";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";

describe("action de reordenar links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "owner" });
    mocks.getProfileByUser.mockResolvedValue({ id: "owner", slug: "perfil" });
    mocks.query.mockImplementation(async (sql: string) => (sql.startsWith("select") ? [{ id: A }, { id: B }, { id: C }] : []));
  });

  const update = () => mocks.query.mock.calls.find(([sql]) => String(sql).includes("update links"));

  it("grava a nova ordem só para os links do dono", async () => {
    await reorderLinks([C, A, B]);
    const [sql, params] = update()!;
    expect(sql).toContain("l.profile_id = $1");
    expect(params).toEqual(["owner", [C, A, B]]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/perfil");
  });

  it("ignora ids de terceiros ou repetidos e põe no fim o que ficou de fora", async () => {
    await reorderLinks([C, "00000000-0000-0000-0000-0000000000ff", C]);
    expect(update()![1]).toEqual(["owner", [C, A, B]]);
  });

  it("não grava nada se a entrada não for uma lista", async () => {
    await reorderLinks("x" as unknown as string[]);
    expect(update()).toBeUndefined();
  });
});
