import { NextResponse, type NextRequest } from "next/server";
import { billingEnabled, expireOverdue, processPending } from "@/server/billing";
import { purgeExpiredLoginLinks } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Cron diário da Vercel (vercel.json): reprocessa eventos pendentes do Asaas e encerra
 * carências vencidas. A Vercel manda "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // A limpeza é secundária: se falhar, a cobrança abaixo roda do mesmo jeito.
  const purged = await purgeExpiredLoginLinks().catch((err) => {
    console.error("[cron] falha ao limpar links de login vencidos", err);
    return null;
  });
  if (!billingEnabled()) return NextResponse.json({ skipped: "billing desligado", purged });

  const processed = await processPending(100);
  const expired = await expireOverdue();
  return NextResponse.json({ processed, expired, purged });
}
