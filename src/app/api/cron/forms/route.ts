import { NextResponse, type NextRequest } from "next/server";
import { prunePartialResponses } from "@/server/forms";

export const dynamic = "force-dynamic";

/** Execução periódica autenticada com o mesmo segredo dos demais crons. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ deleted: await prunePartialResponses() });
}
