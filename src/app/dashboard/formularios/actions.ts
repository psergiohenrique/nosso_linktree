"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { FIELD_LIMITS, parseFields, validateFormSlug } from "@/lib/form-fields";
import { requireUser } from "@/server/auth";
import { createBuilderForm, deleteOwnedForm, formsEnabled, getOwnedForm, updateBuilderForm } from "@/server/forms";
import { SITE_URL } from "@/lib/site";
import { addLink } from "@/app/dashboard/actions";
import { getLinksByProfile, getProfileByUser } from "@/server/profiles";

async function authorized() {
  const user = await requireUser();
  if (!(await formsEnabled(user.id))) notFound();
  return user;
}

export async function createForm() {
  const user = await authorized();
  const form = await createBuilderForm(user.id, "Novo formulário");
  if (!form) redirect("/dashboard/formularios?error=Não%20foi%20possível%20criar%20o%20formulário.");
  revalidatePath("/dashboard/formularios");
  redirect(`/dashboard/formularios/editar/${form.id}`);
}

async function hasFormLink(profile: { id: string; slug: string }, formSlug: string) {
  const url = `${SITE_URL}/${profile.slug}/f/${formSlug}`;
  return (await getLinksByProfile(profile.id)).some((link) => link.url === url);
}

export async function removeForm(data: FormData) {
  const user = await authorized();
  if (data.get("confirm") !== "on") redirect("/dashboard/formularios?error=Confirme%20a%20exclusão%20das%20respostas.");
  const form = await getOwnedForm(user.id, String(data.get("id") ?? ""));
  if (!form || form.fields === null) notFound();
  const profile = await getProfileByUser(user.id);
  if (profile && form.slug && await hasFormLink(profile, form.slug)) {
    redirect(`/dashboard/formularios?error=${encodeURIComponent("Remova primeiro o link deste formulário na aba Links para poder excluí-lo.")}`);
  }
  if (!(await deleteOwnedForm(user.id, form.id))) notFound();
  if (profile && form.slug) revalidatePath(`/${profile.slug}/f/${form.slug}`);
  revalidatePath("/dashboard/formularios");
  redirect("/dashboard/formularios?formExcluido=1");
}

export async function addFormLink(data: FormData) {
  const user = await authorized();
  const form = await getOwnedForm(user.id, String(data.get("id") ?? ""));
  const profile = await getProfileByUser(user.id);
  if (!form || form.fields === null || !form.is_published || !form.slug || !profile) notFound();
  const url = `${SITE_URL}/${profile.slug}/f/${form.slug}`;
  const links = await getLinksByProfile(profile.id);
  if (links.some((link) => link.url === url)) {
    redirect(`/dashboard/formularios?error=${encodeURIComponent("Este formulário já está na página de links. Edite ou ative o link existente na aba Links.")}`);
  }
  const link = new FormData();
  link.set("title", form.title || form.name);
  link.set("url", url);
  await addLink(link);
  redirect("/dashboard/formularios?linkAdicionado=1");
}

export type EditorState = { error?: string; saved?: boolean };

export async function saveForm(id: string, _state: EditorState, data: FormData): Promise<EditorState> {
  const user = await authorized();
  const existing = await getOwnedForm(user.id, id);
  if (!existing || existing.fields === null) notFound();
  const text = (key: string, max: number) => String(data.get(key) ?? "").trim().slice(0, max);
  const name = text("name", FIELD_LIMITS.name);
  const title = text("title", FIELD_LIMITS.title);
  const slug = validateFormSlug(String(data.get("slug") ?? ""));
  if (!name || !title) return { error: "Informe o nome e o título do formulário." };
  if (!slug) return { error: "Informe um endereço com pelo menos duas letras ou números." };
  let raw: unknown;
  try { raw = JSON.parse(String(data.get("fields") ?? "")); } catch { return { error: "Perguntas inválidas." }; }
  const parsed = parseFields(raw);
  if ("error" in parsed) return { error: parsed.error };
  const profile = await getProfileByUser(user.id);
  if (profile && existing.slug && (slug !== existing.slug || data.get("isPublished") !== "on") && await hasFormLink(profile, existing.slug)) {
    return { error: "Remova primeiro o link deste formulário na aba Links para mudar o endereço ou despublicá-lo." };
  }
  const result = await updateBuilderForm(user.id, id, {
    name, title, slug, fields: parsed.fields,
    intro: text("intro", FIELD_LIMITS.intro), thankYou: text("thankYou", FIELD_LIMITS.thankYou),
    isPublished: data.get("isPublished") === "on", notifyEmail: data.get("notifyEmail") === "on",
  });
  if (result === "not_found") notFound();
  if (result === "slug_taken") return { error: "Esse endereço já está em uso por outro formulário." };
  if (profile) {
    if (existing.slug) revalidatePath(`/${profile.slug}/f/${existing.slug}`);
    revalidatePath(`/${profile.slug}/f/${slug}`);
  }
  revalidatePath("/dashboard/formularios");
  return { saved: true };
}
