import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FormAnswer, FormResponsePayload, FormResponseStatus } from "@/lib/forms";
import { query, queryOne } from "./db";

/**
 * Formulários de sites externos: o site envia cada etapa para POST /api/forms/respostas
 * com a chave do formulário, e a resposta fica "partial" até a pessoa enviar.
 * Sem RLS: toda leitura do painel filtra por forms.owner_id.
 */

export type FormRow = { id: string; owner_id: string; name: string; key_version: number; created_at: Date };

export type FormResponseRow = {
  id: string;
  form_id: string;
  form_name: string;
  status: FormResponseStatus;
  answers: FormAnswer[];
  step: number;
  total_steps: number;
  contact_name: string | null;
  contact_phone: string | null;
  page_url: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

/** Respostas novas aceitas por formulário por hora (contra abuso do formulário do site). */
export const NEW_RESPONSES_PER_HOUR = 300;
/** Respostas incompletas mais antigas que isso são apagadas (LGPD: não guardar o que não foi enviado para sempre). */
export const PARTIAL_RETENTION_DAYS = 180;
export const RESPONSES_PAGE_SIZE = 50;

const KEY_PREFIX = "lbf_";

/** Segredo das chaves de formulário: FORMS_KEY_SECRET (independente do APP_SECRET), ou o APP_SECRET se não houver. */
function keySignature(id: string, version: number) {
  return createHmac("sha256", process.env.FORMS_KEY_SECRET || process.env.APP_SECRET || "")
    .update(`form|${id}|${version}`)
    .digest("base64url")
    .slice(0, 32);
}

/** Chave da API do formulário. Não é gravada: é derivada do id e da versão, então o admin pode vê-la de novo. */
export function formKey(form: Pick<FormRow, "id" | "key_version">) {
  return `${KEY_PREFIX}${form.id.replace(/-/g, "")}_${keySignature(form.id, form.key_version)}`;
}

/** Separa "lbf_<id sem hífens>_<assinatura>" em id (com hífens) e assinatura. */
export function parseFormKey(key: string) {
  const m = /^lbf_([0-9a-f]{32})_([A-Za-z0-9_-]{32})$/.exec(key.trim());
  if (!m) return null;
  const h = m[1];
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  return { id, signature: m[2] };
}

export async function findFormByKey(key: string) {
  const parsed = parseFormKey(key);
  if (!parsed) return null;
  const form = await queryOne<FormRow>("select * from forms where id = $1", [parsed.id]);
  if (!form) return null;
  const expected = Buffer.from(keySignature(form.id, form.key_version));
  const given = Buffer.from(parsed.signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? form : null;
}

export type SaveResult = "saved" | "ignored" | "rate_limited";

/**
 * Cria ou atualiza a resposta (form_id, client_id). Uma resposta já completa não volta a parcial:
 * um envio parcial atrasado (rede lenta) depois do envio final é ignorado.
 */
export async function saveResponse(formId: string, p: FormResponsePayload): Promise<SaveResult> {
  const exists = await queryOne<{ id: string }>(
    "select id from form_responses where form_id = $1 and client_id = $2",
    [formId, p.clientId],
  );
  if (!exists) {
    const recent = await queryOne<{ n: string }>(
      "select count(*) as n from form_responses where form_id = $1 and created_at > now() - interval '1 hour'",
      [formId],
    );
    if (Number(recent?.n ?? 0) >= NEW_RESPONSES_PER_HOUR) return "rate_limited";
  }

  const row = await queryOne<{ id: string }>(
    `insert into form_responses
       (form_id, client_id, status, answers, step, total_steps, contact_name, contact_phone, page_url, completed_at)
     values ($1, $2, $3::text, $4::jsonb, $5, $6, $7, $8, $9, case when $3::text = 'complete' then now() end)
     on conflict (form_id, client_id) do update set
       status = excluded.status,
       answers = excluded.answers,
       step = excluded.step,
       total_steps = excluded.total_steps,
       contact_name = coalesce(excluded.contact_name, form_responses.contact_name),
       contact_phone = coalesce(excluded.contact_phone, form_responses.contact_phone),
       page_url = coalesce(form_responses.page_url, excluded.page_url),
       updated_at = now(),
       completed_at = coalesce(form_responses.completed_at, excluded.completed_at)
     where form_responses.status = 'partial' or excluded.status = 'complete'
     returning id`,
    [
      formId,
      p.clientId,
      p.status,
      JSON.stringify(p.answers),
      p.step,
      p.totalSteps,
      p.contactName,
      p.contactPhone,
      p.pageUrl,
    ],
  );

  // Limpeza ocasional das incompletas antigas.
  if (Math.random() < 0.02) {
    await query(
      `delete from form_responses
        where status = 'partial' and updated_at < now() - make_interval(days => $1)`,
      [PARTIAL_RETENTION_DAYS],
    );
  }
  return row ? "saved" : "ignored";
}

// ── Painel (sempre filtrado pelo dono) ──────────────────────────────────────

export async function listForms(ownerId: string) {
  return query<FormRow & { total: string; partial: string }>(
    `select f.*,
            count(r.id) as total,
            count(r.id) filter (where r.status = 'partial') as partial
       from forms f
       left join form_responses r on r.form_id = f.id
      where f.owner_id = $1
      group by f.id
      order by f.created_at`,
    [ownerId],
  );
}

export async function hasForms(ownerId: string) {
  const row = await queryOne<{ ok: boolean }>("select exists (select 1 from forms where owner_id = $1) as ok", [
    ownerId,
  ]);
  return Boolean(row?.ok);
}

export type ResponseFilter = { formId?: string; status?: FormResponseStatus; page?: number };

export async function responseCounts(ownerId: string, formId?: string) {
  const row = await queryOne<{ total: string; complete: string; partial: string }>(
    `select count(*) as total,
            count(*) filter (where r.status = 'complete') as complete,
            count(*) filter (where r.status = 'partial') as partial
       from form_responses r
       join forms f on f.id = r.form_id
      where f.owner_id = $1 and ($2::uuid is null or r.form_id = $2)`,
    [ownerId, formId ?? null],
  );
  return {
    total: Number(row?.total ?? 0),
    complete: Number(row?.complete ?? 0),
    partial: Number(row?.partial ?? 0),
  };
}

export async function listResponses(ownerId: string, { formId, status, page = 1 }: ResponseFilter = {}) {
  const offset = (Math.max(1, page) - 1) * RESPONSES_PAGE_SIZE;
  const rows = await query<FormResponseRow & { full_count: string }>(
    `select r.*, f.name as form_name, count(*) over () as full_count
       from form_responses r
       join forms f on f.id = r.form_id
      where f.owner_id = $1
        and ($2::uuid is null or r.form_id = $2)
        and ($3::text is null or r.status = $3)
      order by r.updated_at desc
      limit $4 offset $5`,
    [ownerId, formId ?? null, status ?? null, RESPONSES_PAGE_SIZE, offset],
  );
  return { rows, total: Number(rows[0]?.full_count ?? 0) };
}

export async function getResponse(ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<FormResponseRow>(
    `select r.*, f.name as form_name
       from form_responses r
       join forms f on f.id = r.form_id
      where r.id = $1 and f.owner_id = $2`,
    [id, ownerId],
  );
}

export async function deleteResponse(ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await query(
    `delete from form_responses r using forms f
      where r.id = $1 and r.form_id = f.id and f.owner_id = $2
      returning r.id`,
    [id, ownerId],
  );
  return rows.length > 0;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function createForm(ownerId: string, name: string) {
  return queryOne<FormRow>("insert into forms (owner_id, name) values ($1, $2) returning *", [ownerId, name]);
}

/** Troca a chave: a anterior deixa de valer na hora. */
export async function rotateFormKey(formId: string) {
  return queryOne<FormRow>(
    "update forms set key_version = key_version + 1 where id = $1 returning *",
    [formId],
  );
}

export async function deleteForm(formId: string) {
  await query("delete from forms where id = $1", [formId]);
}
