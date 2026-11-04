// Construtor e formulário público no Postgres. Só roda com TEST_DATABASE_URL.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, query, queryOne } from "@/server/db";
import {
  createBuilderForm,
  deleteOwnedForm,
  getOwnedForm,
  getPublicForm,
  listResponses,
  setFormsEnabled,
  submitPublicResponse,
  updateBuilderForm,
  type BuilderFormInput,
} from "@/server/forms";
import { defaultFields } from "@/lib/form-fields";

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: construtor de formulários", () => {
  let ownerId = "";
  let otherId = "";
  let slug = "";
  const billing = process.env.BILLING_ENABLED;

  beforeAll(async () => {
    process.env.BILLING_ENABLED = "true";
    const users = await query<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'x'), ($2, 'x') returning id",
      [`fb-${randomUUID()}@linkbio.test`, `fb-${randomUUID()}@linkbio.test`],
    );
    [ownerId, otherId] = users.map((u) => u.id);
    slug = `fb-${ownerId.slice(0, 8)}`;
    await query("insert into profiles (id, slug) values ($1, $2)", [ownerId, slug]);
  });

  afterAll(async () => {
    if (billing === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = billing;
    await query("delete from users where id = any($1::uuid[])", [[ownerId, otherId]]);
    await pool?.end();
  });

  const input = (over: Partial<BuilderFormInput> = {}): BuilderFormInput => ({
    name: "Orçamento",
    title: "Peça seu orçamento",
    intro: "",
    thankYou: "",
    slug: "orcamento",
    fields: defaultFields(),
    isPublished: true,
    notifyEmail: false,
    ...over,
  });

  it("cria com endereço livre e perguntas básicas; endereço repetido não salva", async () => {
    const a = (await createBuilderForm(ownerId, "Orçamento"))!;
    const b = (await createBuilderForm(ownerId, "Orçamento"))!;
    expect(a.slug).toBe("orcamento");
    expect(b.slug).toBe("orcamento-2");
    expect(Array.isArray(a.fields) && a.fields.length).toBe(3);
    expect(a.is_published).toBe(false);

    expect(await updateBuilderForm(ownerId, b.id, input({ slug: "orcamento" }))).toBe("slug_taken");
    expect(await updateBuilderForm(otherId, a.id, input())).toBe("not_found");
    expect(await deleteOwnedForm(otherId, b.id)).toBe(false);
    expect(await deleteOwnedForm(ownerId, b.id)).toBe(true);
  });

  it("só aparece em público publicado e com Formulários liberado", async () => {
    const form = (await queryOne<{ id: string }>("select id from forms where owner_id = $1 and slug = 'orcamento'", [
      ownerId,
    ]))!;
    expect(await getPublicForm({ profileSlug: slug, formSlug: "orcamento" })).toBeNull(); // rascunho
    expect(await updateBuilderForm(ownerId, form.id, input())).toBe("ok");
    expect(await getPublicForm({ profileSlug: slug, formSlug: "orcamento" })).toBeNull(); // conta sem acesso
    await setFormsEnabled(ownerId, true);
    const pub = await getPublicForm({ profileSlug: slug.toUpperCase(), formSlug: "orcamento" });
    expect(pub?.id).toBe(form.id);
    expect(pub?.fields).toHaveLength(3);
    expect((await getOwnedForm(ownerId, form.id))?.title).toBe("Peça seu orçamento");
  });

  it("resposta pública: parcial validada, depois completa na mesma linha", async () => {
    const pub = (await getPublicForm({ profileSlug: slug, formSlug: "orcamento" }))!;
    const [nome, zap, msg] = pub.fields.map((f) => f.id);
    const responseId = randomUUID();

    expect(
      await submitPublicResponse(pub, { responseId, status: "partial", step: 2, answers: { [nome]: "Ana", [zap]: "12" } }, "10.9.9.9"),
    ).toMatchObject({ ok: false, status: 422, fieldId: zap });

    const partial = await submitPublicResponse(
      pub,
      { responseId, status: "partial", step: 2, answers: { [nome]: "Ana", [zap]: "44999991234" } },
      "10.9.9.9",
    );
    expect(partial.ok).toBe(true);

    let { rows } = await listResponses(ownerId, { formId: pub.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "partial", step: 2, total_steps: 3, contact_phone: "44999991234" });

    const done = await submitPublicResponse(
      pub,
      { responseId, status: "complete", answers: { [nome]: "Ana", [zap]: "44999991234", [msg]: "Oi" } },
      "10.9.9.9",
    );
    expect(done.ok).toBe(true);
    ({ rows } = await listResponses(ownerId, { formId: pub.id }));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("complete");
    expect(rows[0].page_url).toBe(`http://localhost:3000/${slug}/f/orcamento`);
  });

  it("parcial vazia não cria linha e id inválido é recusado", async () => {
    const pub = (await getPublicForm({ profileSlug: slug, formSlug: "orcamento" }))!;
    expect(await submitPublicResponse(pub, { responseId: randomUUID(), status: "partial", step: 0, answers: {} }, "")).toEqual({
      ok: true,
      id: null,
    });
    expect(await submitPublicResponse(pub, { responseId: "x", status: "partial" }, "")).toMatchObject({ status: 400 });
  });
});
