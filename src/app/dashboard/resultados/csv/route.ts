import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_LABELS, exportEvents, type ExportRow } from "@/server/analytics";
import { requireUser } from "@/server/auth";
import { getPlan } from "@/server/billing";
import { getProfileByUser } from "@/server/profiles";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

const COLUMNS: { header: string; value: (r: ExportRow) => string | null }[] = [
  { header: "data_hora", value: (r) => r.at },
  { header: "tipo", value: (r) => (r.type === "view" ? "visualização" : "clique") },
  { header: "link", value: (r) => r.link },
  { header: "origem", value: (r) => SOURCE_LABELS[r.source] ?? r.source },
  { header: "dispositivo", value: (r) => (r.device === "mobile" ? "celular" : r.device ? "computador" : null) },
  { header: "cidade", value: (r) => r.city },
  { header: "estado", value: (r) => r.region },
  { header: "pais", value: (r) => r.country },
  { header: "utm_source", value: (r) => r.utm_source },
  { header: "utm_medium", value: (r) => r.utm_medium },
  { header: "utm_campaign", value: (r) => r.utm_campaign },
];

/** Campo de CSV com ; (padrão do Excel em português), protegido contra fórmulas. */
function cell(value: string | null) {
  if (value == null) return "";
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Exportação dos eventos do período (plano Pro). */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const profile = await getProfileByUser(user.id);
  const plan = await getPlan(user.id);
  if (!profile || !plan.pro) return NextResponse.redirect(new URL("/dashboard/resultados", request.url));

  const raw = Number(request.nextUrl.searchParams.get("days"));
  const days = RANGES.includes(raw) ? raw : 30;
  const rows = await exportEvents(profile.id, days);

  const lines = [COLUMNS.map((c) => c.header).join(";"), ...rows.map((r) => COLUMNS.map((c) => cell(c.value(r))).join(";"))];
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  // BOM para o Excel reconhecer UTF-8 (acentos).
  return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linkbio-${profile.slug}-${days}dias-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
