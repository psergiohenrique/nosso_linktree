// Usa uma transação revertida: a limpeza global nunca persiste sobre dados locais existentes.
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ client: null as PoolClient | null }));
vi.mock("@/server/db", () => ({
  query: async (sql: string, params: unknown[] = []) => (await db.client!.query(sql, params)).rows,
  queryOne: async (sql: string, params: unknown[] = []) => (await db.client!.query(sql, params)).rows[0] ?? null,
}));

import { GET } from "@/app/api/cron/forms/route";
import { createBuilderForm, createForm, deleteOwnedForm, formsEnabled, getOwnedForm, getPublicForm, getResponse, listForms, responseCounts, setFormsEnabled, updateBuilderForm } from "@/server/forms";
import { defaultFields } from "@/lib/form-fields";

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: retenção e isolamento de acesso", () => {
  let pool: Pool;
  let owner = "";
  let other = "";
  let form = "";
  let slug = "";
  const secret = process.env.CRON_SECRET;
  const billing = process.env.BILLING_ENABLED;

  beforeAll(async () => {
    process.env.BILLING_ENABLED = "true";
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    db.client = await pool.connect();
    await db.client.query("begin");
    const users = await db.client.query<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'x'), ($2, 'x') returning id",
      [`privacy-${randomUUID()}@linkbio.test`, `privacy-${randomUUID()}@linkbio.test`],
    );
    [owner, other] = users.rows.map((u) => u.id);
    slug = `privacy-${owner.slice(0, 8)}`;
    await db.client.query("insert into profiles (id, slug) values ($1, $2)", [owner, slug]);
    form = (await createBuilderForm(owner, "Contato"))!.id;
  });

  afterAll(async () => {
    if (billing === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = billing;
    if (secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secret;
    if (db.client) {
      await db.client.query("rollback");
      db.client.release();
      db.client = null;
    }
    await pool?.end();
  });

  it("cron autenticado remove apenas parciais anteriores ao prazo, preservando completas e recentes", async () => {
    const inserted = await db.client!.query<{ id: string }>(
      `insert into form_responses (form_id, client_id, status, answers, updated_at)
       values ($1, $2, 'partial', '[]', now() - interval '181 days'),
              ($1, $3, 'partial', '[]', now() - interval '180 days'),
              ($1, $4, 'partial', '[]', now() - interval '179 days'),
              ($1, $5, 'complete', '[]', now() - interval '181 days') returning id`,
      [form, randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    );
    const ids = inserted.rows.map((r) => r.id);
    process.env.CRON_SECRET = "test-cron-secret";
    expect((await GET(new NextRequest("http://localhost/api/cron/forms"))).status).toBe(401);
    expect((await db.client!.query("select id from form_responses where id = any($1::uuid[])", [ids])).rowCount).toBe(4);
    const response = await GET(new NextRequest("http://localhost/api/cron/forms", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).deleted).toBeGreaterThanOrEqual(1);
    const remaining = await db.client!.query<{ id: string }>("select id from form_responses where id = any($1::uuid[])", [ids]);
    expect(remaining.rows.map((r) => r.id).sort()).toEqual(ids.slice(1).sort());
  });

  it("revogação oculta formulário público sem apagar dados; outra conta não administra nem lê", async () => {
    const input = { name: "Contato", title: "Contato", intro: "", thankYou: "", slug: "contato", fields: defaultFields(), isPublished: true, notifyEmail: false };
    expect(await updateBuilderForm(owner, form, input)).toBe("ok");
    expect(await setFormsEnabled(owner, true)).toBe(true);
    expect(await formsEnabled(owner)).toBe(true);
    expect((await getPublicForm({ id: form }))?.id).toBe(form);
    const response = await db.client!.query<{ id: string }>(
      "insert into form_responses (form_id, client_id, status, answers) values ($1, $2, 'complete', '[]') returning id", [form, randomUUID()],
    );
    expect(await getOwnedForm(other, form)).toBeNull();
    expect(await updateBuilderForm(other, form, input)).toBe("not_found");
    expect(await deleteOwnedForm(other, form)).toBe(false);
    expect(await getResponse(other, response.rows[0].id)).toBeNull();
    expect(await responseCounts(other, form)).toEqual({ total: 0, complete: 0, partial: 0 });
    expect(await listForms(other)).toHaveLength(0);
    await setFormsEnabled(owner, false);
    expect(await getPublicForm({ profileSlug: slug, formSlug: "contato" })).toBeNull();
    expect(await getResponse(owner, response.rows[0].id)).not.toBeNull();
    await setFormsEnabled(owner, true);
    expect((await getPublicForm({ id: form }))?.id).toBe(form);
    expect(await deleteOwnedForm(owner, form)).toBe(true);
    expect(await getResponse(owner, response.rows[0].id)).toBeNull();
    const external = (await createForm(owner, "Externo"))!;
    expect(await deleteOwnedForm(owner, external.id)).toBe(false);
    expect(await getOwnedForm(owner, external.id)).not.toBeNull();
  });
});
