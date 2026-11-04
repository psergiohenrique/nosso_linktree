import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryOne: vi.fn(), getPlan: vi.fn() }));
vi.mock("@/server/db", () => ({ query: vi.fn(), queryOne: mocks.queryOne }));
vi.mock("@/server/billing", () => ({ getPlan: mocks.getPlan }));

import { findFormByKey, formKey, formsEnabled, getPublicForm } from "@/server/forms";
import { defaultFields } from "@/lib/form-fields";

const form = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "owner",
  key_version: 1,
  fields: defaultFields(),
};

describe("acesso efetivo a Formulários", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ])("Pro %s e concessão %s resultam em acesso %s", async (pro, granted, expected) => {
    mocks.getPlan.mockResolvedValue({ pro });
    mocks.queryOne.mockResolvedValue({ forms_enabled: granted });
    expect(await formsEnabled(form.owner_id)).toBe(expected);
    expect(mocks.getPlan).toHaveBeenCalledWith(form.owner_id);
  });

  it.each([false, true])("aplica acesso %s ao formulário público e à chave externa", async (pro) => {
    mocks.getPlan.mockResolvedValue({ pro });
    mocks.queryOne.mockImplementation(async (sql: string) =>
      sql.includes("select forms_enabled") ? { forms_enabled: false } : form,
    );
    expect(Boolean(await getPublicForm({ id: form.id }))).toBe(pro);
    expect(Boolean(await findFormByKey(formKey(form)))).toBe(pro);
  });
});
