import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, query, queryOne } from "@/server/db";
import { saveResponse } from "@/server/forms";
import type { FormResponsePayload } from "@/lib/forms";

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: ordem das respostas públicas", () => {
  let owner = "";
  let form = "";
  beforeAll(async () => {
    owner = (await queryOne<{ id: string }>("insert into users (email, password_hash) values ($1, 'x') returning id", [`ordem-${randomUUID()}@linkbio.test`]))!.id;
    form = (await queryOne<{ id: string }>("insert into forms (owner_id, name) values ($1, 'Teste') returning id", [owner]))!.id;
  });
  afterAll(async () => {
    await query("delete from users where id = $1", [owner]);
    await pool?.end();
  });
  const payload = (clientId: string, value: string, status: "partial" | "complete" = "partial"): FormResponsePayload => ({
    clientId, status, answers: [{ id: "nome", label: "Nome", value }], step: 1, totalSteps: 2,
    contactName: value, contactPhone: null, pageUrl: null,
  });
  const row = (clientId: string) => queryOne<{ contact_name: string; status: string; public_version: string }>(
    "select contact_name, status, public_version from form_responses where form_id = $1 and client_id = $2", [form, clientId],
  );

  it("rejeita versão atrasada, repetida e lacuna; aceita edição ao voltar", async () => {
    const id = randomUUID();
    expect((await saveResponse(form, payload(id, "primeira"), 1)).result).toBe("saved");
    expect((await saveResponse(form, payload(id, "editada"), 2)).result).toBe("saved");
    expect((await saveResponse(form, payload(id, "atrasada"), 1)).result).toBe("ignored");
    expect((await saveResponse(form, payload(id, "duplicada"), 2)).result).toBe("ignored");
    expect((await saveResponse(form, payload(id, "lacuna"), 4)).result).toBe("ignored");
    expect(await row(id)).toMatchObject({ contact_name: "editada", public_version: "2" });
  });

  it("duas abas concorrentes com a mesma versão não sobrescrevem uma à outra", async () => {
    const id = randomUUID();
    await saveResponse(form, payload(id, "início"), 1);
    const results = await Promise.all([saveResponse(form, payload(id, "aba A"), 2), saveResponse(form, payload(id, "aba B"), 2)]);
    expect(results.map((r) => r.result).sort()).toEqual(["ignored", "saved"]);
    expect(["aba A", "aba B"]).toContain((await row(id))?.contact_name);
  });

  it("parcial e envio final concorrentes nunca regridem uma resposta completa", async () => {
    const id = randomUUID();
    await saveResponse(form, payload(id, "início"), 1);
    const results = await Promise.all([
      saveResponse(form, payload(id, "parcial"), 2),
      saveResponse(form, payload(id, "final", "complete"), 2),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual(["ignored", "saved"]);
    const saved = await row(id);
    if (saved?.status === "complete") {
      expect((await saveResponse(form, payload(id, "tardia"), 3)).result).toBe("ignored");
      expect(await row(id)).toMatchObject({ status: "complete", contact_name: "final" });
    } else {
      expect(saved).toMatchObject({ status: "partial", contact_name: "parcial" });
    }
  });

  it("completa não regride nem é substituída por requisições públicas ou antigas sem versão", async () => {
    const id = randomUUID();
    await saveResponse(form, payload(id, "final", "complete"), 2);
    expect((await saveResponse(form, payload(id, "atrasada"), 1)).result).toBe("ignored");
    expect((await saveResponse(form, payload(id, "outra", "complete"), 3)).result).toBe("ignored");
    expect((await saveResponse(form, payload(id, "antiga"))).result).toBe("ignored");
    expect(await row(id)).toMatchObject({ contact_name: "final", status: "complete" });
  });
});
