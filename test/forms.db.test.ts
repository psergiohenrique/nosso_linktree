// Gravação das respostas de formulário no Postgres. Só roda com TEST_DATABASE_URL.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseResponsePayload } from "@/lib/forms";
import { pool, query, queryOne } from "@/server/db";
import {
  createForm,
  deleteResponse,
  findFormByKey,
  formKey,
  getResponse,
  listResponses,
  rotateFormKey,
  saveResponse,
  setFormsEnabled,
} from "@/server/forms";

const payload = (clientId: string, status: "partial" | "complete", values: string[]) =>
  parseResponsePayload({
    responseId: clientId,
    status,
    step: values.length,
    totalSteps: 3,
    answers: ["nome", "whatsapp", "mensagem"].map((id, i) => ({ id, label: id, value: values[i] ?? "" })),
  })!;

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: formulários", () => {
  let ownerId = "";
  let otherId = "";
  let formId = "";
  const billing = process.env.BILLING_ENABLED;

  beforeAll(async () => {
    process.env.BILLING_ENABLED = "true";
    const users = await query<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'x'), ($2, 'x') returning id",
      [`forms-${randomUUID()}@linkbio.test`, `forms-${randomUUID()}@linkbio.test`],
    );
    [ownerId, otherId] = users.map((u) => u.id);
    formId = (await createForm(ownerId, "Contato do site"))!.id;
    await setFormsEnabled(ownerId, true);
  });

  afterAll(async () => {
    if (billing === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = billing;
    await query("delete from users where id = any($1::uuid[])", [[ownerId, otherId]]);
    await pool?.end();
  });

  it("a chave encontra o formulário e deixa de valer ao ser trocada", async () => {
    const form = await queryOne<{ id: string; key_version: number }>("select * from forms where id = $1", [formId]);
    const key = formKey(form!);
    expect((await findFormByKey(key))?.id).toBe(formId);
    expect(await findFormByKey(key.slice(0, -1) + (key.endsWith("A") ? "B" : "A"))).toBeNull();

    const rotated = await rotateFormKey(formId);
    expect(await findFormByKey(key)).toBeNull();
    expect((await findFormByKey(formKey(rotated!)))?.id).toBe(formId);
  });

  it("revogar bloqueia a chave sem apagar respostas, e liberar a restaura", async () => {
    const form = (await queryOne<{ id: string; key_version: number }>("select * from forms where id = $1", [formId]))!;
    const key = formKey(form);
    const saved = await saveResponse(formId, payload(randomUUID(), "partial", ["Teste acesso"]));
    expect(await setFormsEnabled(ownerId, false)).toBe(true);
    expect(await findFormByKey(key)).toBeNull();
    expect(await getResponse(ownerId, saved.id!)).not.toBeNull();
    expect(await setFormsEnabled(ownerId, true)).toBe(true);
    expect((await findFormByKey(key))?.id).toBe(formId);
    expect(await getResponse(ownerId, saved.id!)).not.toBeNull();
    expect(await setFormsEnabled(randomUUID(), true)).toBe(false);
  });

  it("parcial atualiza a mesma linha, vira completa e não volta a parcial", async () => {
    const clientId = randomUUID();
    expect((await saveResponse(formId, payload(clientId, "partial", ["Ana"]))).result).toBe("saved");
    expect((await saveResponse(formId, payload(clientId, "partial", ["Ana", "44999991234"]))).result).toBe("saved");

    let { rows } = await listResponses(ownerId, { formId, status: "partial" });
    const partial = rows.find((r) => r.contact_name === "Ana")!;
    expect(partial.step).toBe(2);
    expect(partial.contact_phone).toBe("44999991234");
    expect(partial.completed_at).toBeNull();

    expect((await saveResponse(formId, payload(clientId, "complete", ["Ana", "44999991234", "Oi"]))).result).toBe("saved");
    // Envio parcial atrasado depois do final: ignorado.
    expect((await saveResponse(formId, payload(clientId, "partial", ["Ana"]))).result).toBe("ignored");

    const done = (await getResponse(ownerId, partial.id))!;
    expect(done.status).toBe("complete");
    expect(done.step).toBe(3);
    expect(done.answers.map((a) => a.value)).toEqual(["Ana", "44999991234", "Oi"]);
    expect(done.completed_at).not.toBeNull();

    ({ rows } = await listResponses(ownerId, { formId, status: "partial" }));
    expect(rows.find((r) => r.id === partial.id)).toBeUndefined();
  });

  it("outra conta não vê nem apaga as respostas", async () => {
    const clientId = randomUUID();
    await saveResponse(formId, payload(clientId, "partial", ["Bia"]));
    const { rows } = await listResponses(ownerId, { formId });
    const bia = rows.find((r) => r.contact_name === "Bia")!;

    expect((await listResponses(otherId)).total).toBe(0);
    expect(await getResponse(otherId, bia.id)).toBeNull();
    expect(await deleteResponse(otherId, bia.id)).toBe(false);
    expect(await deleteResponse(ownerId, bia.id)).toBe(true);
    expect(await getResponse(ownerId, bia.id)).toBeNull();
  });
});
