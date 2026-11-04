"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/admin";
import { query, queryOne } from "@/server/db";
import { createForm, deleteForm, rotateFormKey, setFormsEnabled } from "@/server/forms";

const UUID = /^[0-9a-f-]{36}$/i;

function back(userId: string, params: Record<string, string>): never {
  redirect(`/admin/contas/${userId}?${new URLSearchParams(params)}`);
}

/** A página pública fica em cache: a cortesia muda o selo e os links visíveis. */
async function refreshPublicPage(userId: string) {
  const profile = await queryOne<{ slug: string }>("select slug from profiles where id = $1", [userId]);
  if (profile) revalidatePath(`/${profile.slug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/admin/contas/${userId}`);
}

/** Dá (ou estende) o Pro de cortesia até o fim do dia escolhido, no horário de Brasília. */
export async function setCourtesy(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!UUID.test(userId)) redirect("/admin/contas");

  const day = String(formData.get("until") ?? "");
  const until = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T23:59:59-03:00`) : null;
  if (!until || Number.isNaN(until.getTime())) back(userId, { error: "Data inválida." });
  if (until <= new Date()) back(userId, { error: "A data precisa ser no futuro." });

  const user = await queryOne<{ id: string }>("select id from users where id = $1", [userId]);
  if (!user) redirect("/admin/contas");

  // Sem linha em subscriptions (nunca abriu checkout): cria uma só para guardar a cortesia.
  await query(
    `insert into subscriptions (user_id, courtesy_until) values ($1, $2)
     on conflict (user_id) do update set courtesy_until = excluded.courtesy_until, updated_at = now()`,
    [userId, until],
  );
  console.info(`[admin] ${admin.email} deu cortesia até ${day} para ${userId}`);
  await refreshPublicPage(userId);
  back(userId, { ok: "cortesia" });
}

export async function removeCourtesy(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!UUID.test(userId)) redirect("/admin/contas");

  await query("update subscriptions set courtesy_until = null, updated_at = now() where user_id = $1", [userId]);
  console.info(`[admin] ${admin.email} removeu a cortesia de ${userId}`);
  await refreshPublicPage(userId);
  back(userId, { ok: "sem-cortesia" });
}

/** Concessão manual independente do Pro; removê-la não apaga dados ou chaves. */
export async function adminSetFormsEnabled(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const value = formData.get("enabled");
  if (!UUID.test(userId)) redirect("/admin/contas");
  if (value !== "1" && value !== "0") back(userId, { error: "Estado de acesso inválido." });
  const enabled = value === "1";
  if (!(await setFormsEnabled(userId, enabled))) redirect("/admin/contas");
  console.info(`[admin] ${admin.email} ${enabled ? "ativou" : "removeu"} a concessão manual de Formulários para ${userId}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/admin/contas/${userId}`);
  back(userId, { ok: enabled ? "forms-liberado" : "forms-revogado" });
}

/** Cria um formulário externo, sem alterar a liberação da conta. */
export async function adminCreateForm(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!UUID.test(userId)) redirect("/admin/contas");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) back(userId, { error: "Dê um nome ao formulário." });

  const user = await queryOne<{ id: string }>("select id from users where id = $1", [userId]);
  if (!user) redirect("/admin/contas");

  const form = await createForm(userId, name);
  console.info(`[admin] ${admin.email} criou o formulário ${form?.id} para ${userId}`);
  revalidatePath("/dashboard", "layout");
  back(userId, { ok: "formulario" });
}

async function ownedForm(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const formId = String(formData.get("form_id") ?? "");
  if (!UUID.test(userId) || !UUID.test(formId)) redirect("/admin/contas");
  const form = await queryOne<{ id: string }>("select id from forms where id = $1 and owner_id = $2", [formId, userId]);
  if (!form) back(userId, { error: "Formulário não encontrado." });
  return { userId, formId };
}

export async function adminRotateFormKey(formData: FormData) {
  const admin = await requireAdmin();
  const { userId, formId } = await ownedForm(formData);
  await rotateFormKey(formId);
  console.info(`[admin] ${admin.email} trocou a chave do formulário ${formId}`);
  back(userId, { ok: "chave" });
}

export async function adminDeleteForm(formData: FormData) {
  const admin = await requireAdmin();
  const { userId, formId } = await ownedForm(formData);
  await deleteForm(formId);
  console.info(`[admin] ${admin.email} apagou o formulário ${formId} de ${userId}`);
  revalidatePath("/dashboard", "layout");
  back(userId, { ok: "sem-formulario" });
}
