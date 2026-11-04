import { NextResponse, type NextRequest } from "next/server";
import { getPublicForm, submitPublicResponse } from "@/server/forms";
import { clientIp } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;

/** Respostas da página pública /<perfil>/f/<formulário>, etapa por etapa (sem chave: vem do navegador). */
export async function POST(request: NextRequest) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });

  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    // cai no 400 abaixo
  }
  const formId = typeof body?.formId === "string" ? body.formId : "";
  const form = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formId)
    ? await getPublicForm({ id: formId })
    : null;
  if (!form) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const result = await submitPublicResponse(form, body, await clientIp());
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, fieldId: result.fieldId }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
