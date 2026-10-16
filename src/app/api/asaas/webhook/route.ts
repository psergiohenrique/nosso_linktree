import { NextResponse, type NextRequest } from "next/server";
import { billingEnabled, ingestEvent, isAuthenticWebhook, processEvent, processPending } from "@/server/billing";

export const dynamic = "force-dynamic";

/**
 * Webhook do Asaas. Autentica pelo token fixo, grava o evento (idempotente) e responde 200.
 * O processamento roda em seguida; o que falhar fica na fila para a próxima entrega ou o cron.
 * Desligado (BILLING_ENABLED != "true"): 404, como se não existisse.
 */
export async function POST(request: NextRequest) {
  if (!billingEnabled()) return new NextResponse(null, { status: 404 });
  if (!isAuthenticWebhook(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventId = await ingestEvent(body);
  if (eventId) await processEvent(eventId, true);
  // Aproveita a chamada para pegar eventos que estavam esperando nova tentativa.
  await processPending(5).catch((err) => console.error("[billing] pendentes", err));

  return NextResponse.json({ received: true });
}
