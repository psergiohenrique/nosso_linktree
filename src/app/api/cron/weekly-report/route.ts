import { NextResponse, type NextRequest } from "next/server";
import { sendWeeklyReports } from "@/server/weekly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron semanal da Vercel (vercel.json, segunda 9h de Brasília): manda o resumo da semana por e-mail.
 * A Vercel manda "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendWeeklyReports(200));
}
