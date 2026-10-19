import { NextResponse, type NextRequest } from "next/server";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { isValidUnsubscribe, setWeeklyReport } from "@/server/weekly-report";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

async function unsubscribe(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  if (!UUID.test(u) || !isValidUnsubscribe(u, t)) return false;
  await setWeeklyReport(u, false);
  return true;
}

function page(title: string, message: string, status = 200) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — ${SITE_NAME}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#17181a">
<h1 style="font-size:24px">${title}</h1><p>${message}</p><p><a href="${SITE_URL}/dashboard/resultados" style="color:#17181a">Ir para o painel</a></p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Link "Descadastrar" do resumo semanal (sem login: o link é assinado). */
export async function GET(request: NextRequest) {
  return (await unsubscribe(request))
    ? page("Pronto, resumo desligado", "Você não vai mais receber o resumo semanal. Dá para religar quando quiser na aba Resultados do painel.")
    : page("Link inválido", "Este link de descadastro não é válido. Você pode desligar o resumo na aba Resultados do painel.", 400);
}

/** Descadastro em um clique dos clientes de e-mail (List-Unsubscribe-Post, RFC 8058). */
export async function POST(request: NextRequest) {
  const ok = await unsubscribe(request);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
