import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { checkAnswers, defaultFields, storedFields, validateFormSlug, type FormField } from "@/lib/form-fields";
import type { FormAnswer, FormResponsePayload, FormResponseStatus } from "@/lib/forms";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { query, queryOne } from "./db";
import { sendMail } from "./mail";
import { isRateLimited, recordAttempt } from "./rate-limit";

/**
 * Formulários de sites externos: o site envia cada etapa para POST /api/forms/respostas
 * com a chave do formulário, e a resposta fica "partial" até a pessoa enviar.
 * Sem RLS: toda leitura do painel filtra por forms.owner_id.
 */

export type FormRow = {
  id: string;
  owner_id: string;
  name: string;
  key_version: number;
  created_at: Date;
  updated_at: Date;
  /** Endereço público (/<perfil>/f/<slug>); null nos formulários externos. */
  slug: string | null;
  /** Perguntas do construtor; null = formulário externo (site do cliente via API). */
  fields: unknown;
  title: string;
  intro: string;
  thank_you: string;
  is_published: boolean;
  notify_email: boolean;
};

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
/** Respostas incompletas sem atualização há mais tempo que isso podem ser apagadas. */
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
  const form = await queryOne<FormRow>(
    "select f.* from forms f join users u on u.id = f.owner_id where f.id = $1 and u.forms_enabled",
    [parsed.id],
  );
  if (!form) return null;
  const expected = Buffer.from(keySignature(form.id, form.key_version));
  const given = Buffer.from(parsed.signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? form : null;
}

export type SaveResult = "saved" | "ignored" | "rate_limited";

/**
 * Cria ou atualiza a resposta (form_id, client_id). Uma resposta já completa não volta a parcial:
 * um envio parcial atrasado (rede lenta) depois do envio final é ignorado.
 * `completedNow`: esta gravação transformou a resposta em completa (para avisar o dono uma vez só).
 */
export async function saveResponse(
  formId: string,
  p: FormResponsePayload,
  publicVersion?: number,
  publicRequest = false,
): Promise<{ result: SaveResult; id: string | null; completedNow: boolean }> {
  const exists = await queryOne<{ id: string; status: FormResponseStatus }>(
    "select id, status from form_responses where form_id = $1 and client_id = $2",
    [formId, p.clientId],
  );
  if (!exists) {
    const recent = await queryOne<{ n: string }>(
      "select count(*) as n from form_responses where form_id = $1 and created_at > now() - interval '1 hour'",
      [formId],
    );
    if (Number(recent?.n ?? 0) >= NEW_RESPONSES_PER_HOUR) return { result: "rate_limited", id: null, completedNow: false };
  }

  const row = await queryOne<{ id: string }>(
    `insert into form_responses
       (form_id, client_id, status, answers, step, total_steps, contact_name, contact_phone, page_url, completed_at, public_version)
     values ($1, $2, $3::text, $4::jsonb, $5, $6, $7, $8, $9, case when $3::text = 'complete' then now() end, $10)
     on conflict (form_id, client_id) do update set
       status = excluded.status,
       answers = excluded.answers,
       step = excluded.step,
       total_steps = excluded.total_steps,
       contact_name = coalesce(excluded.contact_name, form_responses.contact_name),
       contact_phone = coalesce(excluded.contact_phone, form_responses.contact_phone),
       page_url = coalesce(form_responses.page_url, excluded.page_url),
       updated_at = now(),
       completed_at = coalesce(form_responses.completed_at, excluded.completed_at),
       public_version = excluded.public_version
     where (form_responses.status = 'partial' or (excluded.status = 'complete' and not $11::boolean and $10::bigint is null and form_responses.public_version is null))
       and (form_responses.public_version is null or excluded.public_version = form_responses.public_version + 1)
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
      publicVersion ?? null,
      publicRequest,
    ],
  );

  // Limpeza ocasional das incompletas antigas, além da execução periódica.
  if (Math.random() < 0.02) await prunePartialResponses();
  return row
    ? { result: "saved", id: row.id, completedNow: p.status === "complete" && exists?.status !== "complete" }
    : { result: "ignored", id: exists?.id ?? null, completedNow: false };
}

/** Remove apenas respostas parciais sem atualização há mais de 180 dias. */
export async function prunePartialResponses() {
  const row = await queryOne<{ deleted: string }>(
    `with deleted as (
       delete from form_responses
        where status = 'partial' and updated_at < now() - make_interval(days => $1)
       returning 1
     ) select count(*) as deleted from deleted`,
    [PARTIAL_RETENTION_DAYS],
  );
  return Number(row?.deleted ?? 0);
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

/** Formulários liberados para a conta (pelo admin). */
export async function formsEnabled(userId: string) {
  const row = await queryOne<{ forms_enabled: boolean }>("select forms_enabled from users where id = $1", [userId]);
  return Boolean(row?.forms_enabled);
}

export async function setFormsEnabled(userId: string, on: boolean) {
  const rows = await query("update users set forms_enabled = $2 where id = $1 returning id", [userId, on]);
  return rows.length > 0;
}

export async function getOwnedForm(ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<FormRow>("select * from forms where id = $1 and owner_id = $2", [id, ownerId]);
}

const UNIQUE_VIOLATION = "23505";
const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && err.code === UNIQUE_VIOLATION;

/** Formulário novo do construtor, em rascunho, com as perguntas básicas. Endereço livre: nome, nome-2, nome-3… */
export async function createBuilderForm(ownerId: string, name: string) {
  const base = validateFormSlug(name) ?? "formulario";
  for (let n = 1; n <= 20; n++) {
    const slug = n === 1 ? base : `${base.slice(0, 36)}-${n}`;
    try {
      return await queryOne<FormRow>(
        `insert into forms (owner_id, name, title, slug, fields)
         values ($1, $2, $2, $3, $4::jsonb) returning *`,
        [ownerId, name, slug, JSON.stringify(defaultFields())],
      );
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return null;
}

export type BuilderFormInput = {
  name: string;
  title: string;
  intro: string;
  thankYou: string;
  slug: string;
  fields: FormField[];
  isPublished: boolean;
  notifyEmail: boolean;
};

/** Salva o formulário do construtor. Só formulários do próprio dono e que têm perguntas (não os externos). */
export async function updateBuilderForm(
  ownerId: string,
  id: string,
  f: BuilderFormInput,
): Promise<"ok" | "not_found" | "slug_taken"> {
  try {
    const row = await queryOne<{ id: string }>(
      `update forms set name = $3, title = $4, intro = $5, thank_you = $6, slug = $7, fields = $8::jsonb,
              is_published = $9, notify_email = $10, updated_at = now()
        where id = $1 and owner_id = $2 and fields is not null
        returning id`,
      [id, ownerId, f.name, f.title, f.intro, f.thankYou, f.slug, JSON.stringify(f.fields), f.isPublished, f.notifyEmail],
    );
    return row ? "ok" : "not_found";
  } catch (err) {
    if (isUniqueViolation(err)) return "slug_taken";
    throw err;
  }
}

/** Apaga um formulário do próprio dono, com as respostas. */
export async function deleteOwnedForm(ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await query("delete from forms where id = $1 and owner_id = $2 and fields is not null returning id", [id, ownerId]);
  return rows.length > 0;
}

// ── Formulário público (/<perfil>/f/<slug>) ───────────────────────────────

export type PublicForm = FormRow & { fields: FormField[]; owner_email: string; profile_slug: string };

/** Formulário publicado, com perguntas, de uma conta com Formulários liberado. */
export async function getPublicForm(where: { profileSlug: string; formSlug: string } | { id: string }) {
  const byId = "id" in where;
  if (byId && !/^[0-9a-f-]{36}$/i.test(where.id)) return null;
  const row = await queryOne<FormRow & { owner_email: string; profile_slug: string }>(
    `select f.*, u.email as owner_email, p.slug as profile_slug
       from forms f
       join users u on u.id = f.owner_id
       join profiles p on p.id = f.owner_id
      where ${byId ? "f.id = $1" : "p.slug = $1 and f.slug = $2"}
        and f.is_published and f.fields is not null and u.forms_enabled`,
    byId ? [where.id] : [where.profileSlug.toLowerCase(), where.formSlug.toLowerCase()],
  );
  if (!row) return null;
  const fields = storedFields(row.fields) ?? [];
  return fields.length ? ({ ...row, fields } as PublicForm) : null;
}

/** Avisa o dono por e-mail que chegou uma resposta completa. */
export async function notifyOwner(form: PublicForm, responseId: string) {
  const title = form.title || form.name;
  const link = `${SITE_URL}/dashboard/formularios/${responseId}`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = [
    `Nova resposta em “${title}”.`,
    "",
    `Ver no painel: ${link}`,
  ].join("\n");
  const html = `<p>Nova resposta em <b>${esc(title)}</b>.</p>
    <p><a href="${link}">Ver no painel do ${SITE_NAME}</a></p>`;
  await sendMail({ to: form.owner_email, subject: `Nova resposta: ${title}`, text, html });
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublicSubmitResult =
  | { ok: true; id: string | null }
  | { ok: false; status: 400 | 409 | 422 | 429; error: string; fieldId?: string };

/**
 * Resposta vinda da página pública: confere contra as perguntas, limita pessoas novas por IP,
 * grava (parcial ou completa) e avisa o dono por e-mail na primeira vez que fica completa.
 */
export async function submitPublicResponse(
  form: PublicForm,
  body: unknown,
  ip: string,
): Promise<PublicSubmitResult> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const clientId = typeof b.responseId === "string" ? b.responseId.toLowerCase() : "";
  if (!UUID_RE.test(clientId)) return { ok: false, status: 400, error: "invalid" };
  const complete = b.status === "complete";
  if (!complete && b.status !== "partial") return { ok: false, status: 400, error: "invalid" };
  const step = typeof b.step === "number" && Number.isInteger(b.step) ? b.step : 0;
  const version = b.version;
  if (version !== undefined && (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1)) {
    return { ok: false, status: 400, error: "invalid" };
  }

  const checked = checkAnswers(form.fields, b.answers, { complete, step });
  if (!checked.ok) return { ok: false, status: 422, error: checked.error, fieldId: checked.fieldId };
  // Parcial sem nada respondido ainda: não cria linha.
  if (!complete && checked.answers.length === 0) return { ok: true, id: null };

  const known = await queryOne<{ id: string }>(
    "select id from form_responses where form_id = $1 and client_id = $2",
    [form.id, clientId],
  );
  if (!known && ip) {
    if (await isRateLimited("form", { ip })) {
      return { ok: false, status: 429, error: "Muitas respostas seguidas. Tente de novo mais tarde." };
    }
    await recordAttempt("form", { ip });
  }

  const pageUrl = `${SITE_URL}/${form.profile_slug}/f/${form.slug}`;
  const saved = await saveResponse(form.id, {
    clientId,
    status: complete ? "complete" : "partial",
    answers: checked.answers,
    step: complete ? form.fields.length : Math.min(step, form.fields.length),
    totalSteps: form.fields.length,
    contactName: checked.contactName,
    contactPhone: checked.contactPhone,
    pageUrl,
  }, version as number | undefined, true);
  if (saved.result === "ignored" && version !== undefined) {
    return { ok: false, status: 409, error: "Esta resposta foi atualizada em outra aba ou já foi enviada. Abra um novo formulário para continuar." };
  }
  if (saved.result === "rate_limited") {
    return { ok: false, status: 429, error: "Muitas respostas seguidas. Tente de novo mais tarde." };
  }
  if (saved.completedNow && saved.id && form.notify_email) {
    await notifyOwner(form, saved.id).catch((err) => console.error("[forms] aviso ao dono", err));
  }
  return { ok: true, id: saved.id };
}
