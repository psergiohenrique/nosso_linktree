"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/admin";
import { query, queryOne } from "@/server/db";

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
