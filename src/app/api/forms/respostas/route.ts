import { NextResponse, type NextRequest } from "next/server";
import { parseResponsePayload } from "@/lib/forms";
import { findFormByKey, saveResponse } from "@/server/forms";

export const dynamic = "force-dynamic";

/** Corpo máximo aceito (50 respostas de até 4000 caracteres cabem com folga). */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Recebe as respostas de um formulário de site externo, etapa por etapa.
 * Chamado servidor a servidor: `Authorization: Bearer <chave do formulário>`. Sem CORS de propósito,
 * para a chave nunca ir para o navegador.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const form = key ? await findFormByKey(key) : null;
  if (!form) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // cai no 400 abaixo
  }
  const payload = parseResponsePayload(body);
  if (!payload) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const { result } = await saveResponse(form.id, payload);
  if (result === "rate_limited") {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  return NextResponse.json({ ok: true, result });
}
