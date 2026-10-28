"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { BillingError, cancelPlan, getPlan, startCheckout } from "@/server/billing";
import { pool, query, queryOne } from "@/server/db";
import { deleteMedia, saveImage } from "@/server/media";
import { getProfileByUser } from "@/server/profiles";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import {
  BUTTON_STYLES,
  FONTS,
  LINK_LAYOUTS,
  LINK_SIZES,
  THEME_PRESETS,
  WHATSAPP_DEFAULT,
  WHATSAPP_STYLES,
} from "@/lib/types";
import { MAX_URL_LENGTH, oneOf, safeUrl, validColor, validateSlug, whatsappUrl } from "@/lib/validation";
import { emitPostHogLog } from "@/server/posthog-logs";
import { setWeeklyReport } from "@/server/weekly-report";

function fail(message: string, path = "/dashboard"): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function requireProfile() {
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);
  if (!profile) redirect("/dashboard");
  return { user, profile };
}

/** Invalida a página pública e marca a edição (updated_at vira o lastModified do sitemap). */
async function refreshPublicPage(profile: { id: string; slug: string }) {
  await query("update profiles set updated_at = now() where id = $1", [profile.id]);
  revalidatePath(`/${profile.slug}`);
  revalidatePath(`/${profile.slug}/opengraph-image`);
  revalidatePath("/dashboard", "layout");
}

export async function createProfile(formData: FormData) {
  const user = await requireUser();
  const slug = validateSlug(String(formData.get("slug") ?? ""));
  if (!slug) fail("Endereço inválido: use 3 a 30 letras minúsculas, números ou hífen.");

  const created = await queryOne<{ id: string }>(
    `insert into profiles (id, slug, display_name) values ($1, $2, $3)
     on conflict do nothing returning id`,
    [user.id, slug, String(formData.get("display_name") ?? "").trim().slice(0, 60)],
  );
  if (!created) fail("Esse endereço já está em uso.");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function updateSlug(formData: FormData) {
  const { user, profile } = await requireProfile();
  const back = "/dashboard/aparencia";
  const slug = validateSlug(String(formData.get("slug") ?? ""));
  if (!slug) fail("Endereço inválido: use 3 a 30 letras minúsculas, números ou hífen.", back);

  try {
    await query("update profiles set slug = $2, updated_at = now() where id = $1", [user.id, slug]);
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
      fail("Esse endereço já está em uso.", back);
    }
    throw err;
  }
  await refreshPublicPage(profile);
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/opengraph-image`);
  revalidatePath("/sitemap.xml");
  redirect(`${back}?endereco=1`);
}

/** Perfil (nome, bio, foto) e aparência, salvos juntos pelo editor de aparência. */
export async function updateAppearance(formData: FormData) {
  const { user, profile } = await requireProfile();
  const back = "/dashboard/aparencia";
  const d = THEME_PRESETS[0].appearance;

  let avatarId = profile.avatar_id;
  const upload = await saveImage(user.id, formData.get("avatar"));
  if (upload && "error" in upload) fail(upload.error, back);
  if (upload) avatarId = upload.id;
  else if (formData.get("remove_avatar") === "1") avatarId = null;

  let coverImageId = profile.cover_image_id;
  const coverUpload = await saveImage(user.id, formData.get("cover_image"));
  if (coverUpload && "error" in coverUpload) fail(coverUpload.error, back);
  if (coverUpload) coverImageId = coverUpload.id;
  else if (formData.get("remove_cover_image") === "1") coverImageId = null;

  // Círculo da inicial: sem cores próprias (null), segue as do botão.
  const buttonColor = validColor(formData.get("button_color"), d.button_color);
  const buttonTextColor = validColor(formData.get("button_text_color"), d.button_text_color);
  const initialCustom = formData.get("initial_custom") === "1";

  await query(
    `update profiles set
       display_name = $2, bio = $3, avatar_id = $4, cover_image_id = $5,
       bg_type = $6, bg_color = $7, bg_color2 = $8, text_color = $9,
       button_color = $10, button_text_color = $11, button_style = $12, font = $13,
       initial_bg_color = $14, initial_text_color = $15,
       whatsapp_style = $16, whatsapp_color = $17, whatsapp_text_color = $18, show_avatar = $19,
       updated_at = now()
     where id = $1`,
    [
      user.id,
      String(formData.get("display_name") ?? "").trim().slice(0, 60),
      String(formData.get("bio") ?? "").trim().slice(0, 200),
      avatarId,
      coverImageId,
      oneOf(formData.get("bg_type"), ["solid", "gradient"] as const, d.bg_type),
      validColor(formData.get("bg_color"), d.bg_color),
      validColor(formData.get("bg_color2"), d.bg_color2),
      validColor(formData.get("text_color"), d.text_color),
      buttonColor,
      buttonTextColor,
      oneOf(formData.get("button_style"), BUTTON_STYLES.map((b) => b.value), d.button_style),
      oneOf(formData.get("font"), FONTS.map((f) => f.value), d.font),
      initialCustom ? validColor(formData.get("initial_bg_color"), buttonColor) : null,
      initialCustom ? validColor(formData.get("initial_text_color"), buttonTextColor) : null,
      oneOf(formData.get("whatsapp_style"), WHATSAPP_STYLES.map((w) => w.value), WHATSAPP_DEFAULT.whatsapp_style),
      validColor(formData.get("whatsapp_color"), WHATSAPP_DEFAULT.whatsapp_color),
      validColor(formData.get("whatsapp_text_color"), WHATSAPP_DEFAULT.whatsapp_text_color),
      formData.get("show_avatar") === "1",
    ],
  );
  if (avatarId !== profile.avatar_id) await deleteMedia(user.id, profile.avatar_id);
  if (coverImageId !== profile.cover_image_id) await deleteMedia(user.id, profile.cover_image_id);

  await refreshPublicPage(profile);
  redirect(`${back}?ok=1`);
}

function readLink(formData: FormData, pro: boolean) {
  const kind = formData.get("kind") === "whatsapp" ? "whatsapp" : "link";
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  if (!title) fail("Dê um título ao link.");

  const rawTarget = String(formData.get("url") ?? "");
  const url =
    kind === "whatsapp" ? whatsappUrl(rawTarget, String(formData.get("message") ?? "")) : safeUrl(rawTarget);
  if (!url) {
    if (kind === "whatsapp") fail("Número de WhatsApp inválido.");
    fail(rawTarget.length > MAX_URL_LENGTH ? "URL longa demais." : "URL inválida.");
  }
  // O banco aceita até 2048 caracteres; no WhatsApp a mensagem codificada pode passar disso.
  if (url.length > MAX_URL_LENGTH) fail("Mensagem do WhatsApp longa demais: encurte o texto.");

  // Destaque e Bloco são do Pro. No Grátis, null: link novo vira botão e o editado mantém o que tinha
  // (a página mostra como botão enquanto estiver no Grátis; volta sozinho se assinar de novo).
  const layout = pro ? oneOf(formData.get("layout"), LINK_LAYOUTS.map((l) => l.value), "button") : null;
  const size = oneOf(formData.get("size"), LINK_SIZES.map((s) => s.value), "md");

  return { kind, title, url, layout, size } as const;
}

export async function addLink(formData: FormData) {
  const { user, profile } = await requireProfile();
  const plan = await getPlan(user.id);
  if (!plan.pro) {
    const count = await queryOne<{ n: string }>("select count(*) as n from links where profile_id = $1", [user.id]);
    if (Number(count?.n ?? 0) >= FREE_LINK_LIMIT) {
      fail(`No plano Grátis são até ${FREE_LINK_LIMIT} links. Assine o Pro para ter links ilimitados.`);
    }
  }
  const link = readLink(formData, plan.pro);
  const upload = await saveImage(user.id, formData.get("thumbnail"));
  if (upload && "error" in upload) fail(upload.error);

  await query(
    `insert into links (profile_id, kind, title, url, thumbnail_id, layout, size, position)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce((select max(position) + 1 from links where profile_id = $1), 0))`,
    [user.id, link.kind, link.title, link.url, upload?.id ?? null, link.layout ?? "button", link.size],
  );
  await refreshPublicPage(profile);
}

export async function updateLink(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const current = await queryOne<{ thumbnail_id: string | null; layout: string }>(
    "select thumbnail_id, layout from links where id = $1 and profile_id = $2",
    [id, user.id],
  );
  if (!current) fail("Link não encontrado.");

  const link = readLink(formData, (await getPlan(user.id)).pro);
  const upload = await saveImage(user.id, formData.get("thumbnail"));
  if (upload && "error" in upload) fail(upload.error);
  const thumbnailId = upload ? upload.id : formData.get("remove_thumbnail") === "on" ? null : current.thumbnail_id;

  await query(
    `update links set kind = $3, title = $4, url = $5, thumbnail_id = $6, is_active = $7, layout = $8, size = $9
     where id = $1 and profile_id = $2`,
    [id, user.id, link.kind, link.title, link.url, thumbnailId, formData.get("is_active") === "on", link.layout ?? current.layout, link.size],
  );
  if (thumbnailId !== current.thumbnail_id) await deleteMedia(user.id, current.thumbnail_id);
  await refreshPublicPage(profile);
}

export async function deleteLink(formData: FormData) {
  const { user, profile } = await requireProfile();
  const removed = await queryOne<{ thumbnail_id: string | null }>(
    "delete from links where id = $1 and profile_id = $2 returning thumbnail_id",
    [String(formData.get("id")), user.id],
  );
  await deleteMedia(user.id, removed?.thumbnail_id);
  await refreshPublicPage(profile);
}

export async function moveLink(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = String(formData.get("id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;

  const links = await query<{ id: string }>("select id from links where profile_id = $1 order by position", [user.id]);
  const index = links.findIndex((l) => l.id === id);
  if (index < 0 || !links[index + dir]) return;

  // Renumera toda a lista numa transação para evitar posições duplicadas.
  [links[index], links[index + dir]] = [links[index + dir], links[index]];
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const [i, l] of links.entries()) {
      await client.query("update links set position = $1 where id = $2 and profile_id = $3", [i, l.id, user.id]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  await refreshPublicPage(profile);
}

// ───────── Plano (cobrança) ─────────

/** Abre o checkout do Asaas (assinar, reativar, trocar de ciclo ou de cartão). */
export async function subscribePro(formData: FormData) {
  const user = await requireUser();
  const cycle = formData.get("cycle") === "yearly" ? "yearly" : "monthly";
  let url: string;
  try {
    url = await startCheckout(user.id, cycle);
  } catch (err) {
    if (err instanceof BillingError) fail(err.message, "/dashboard/plano");
    throw err;
  }
  await emitPostHogLog("checkout_session_created", { operation: "start_checkout", billing_cycle: cycle });
  redirect(url);
}

export async function cancelPro() {
  const user = await requireUser();
  try {
    await cancelPlan(user.id);
  } catch (err) {
    if (err instanceof BillingError) fail(err.message, "/dashboard/plano");
    throw err;
  }
  await emitPostHogLog("subscription_cancellation_requested", { operation: "cancel_subscription" });
  redirect("/dashboard/plano?cancelado=1");
}

export async function toggleWeeklyReport(formData: FormData) {
  const user = await requireUser();
  await setWeeklyReport(user.id, formData.get("on") === "1");
  revalidatePath("/dashboard/resultados");
}

/** Aparecer no Google: desligado, a página ganha noindex e sai do sitemap. */
export async function toggleSearchIndexing(formData: FormData) {
  const { user, profile } = await requireProfile();
  await query("update profiles set search_indexing = $2 where id = $1", [user.id, formData.get("on") === "1"]);
  await refreshPublicPage(profile);
}
