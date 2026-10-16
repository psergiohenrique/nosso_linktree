import { NextResponse, type NextRequest } from "next/server";
import { billingEnabled, expireOverdue, processPending } from "@/server/billing";

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
  if (!billingEnabled()) return NextResponse.json({ skipped: "billing desligado" });

  const processed = await processPending(100);
  const expired = await expireOverdue();
  return NextResponse.json({ processed, expired });
}
