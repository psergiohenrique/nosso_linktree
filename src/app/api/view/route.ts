import { NextResponse, after, type NextRequest } from "next/server";
import { parseUtm, trackEvent } from "@/server/analytics";
import { captureBioEvent } from "@/server/posthog-events";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const profileId = body?.profileId;
  if (typeof profileId !== "string" || !UUID.test(profileId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = await trackEvent({
    profileId,
    linkId: null,
    type: "view",
    headers: request.headers,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
    utm: parseUtm(body.utm),
  });
  if (event) after(() => captureBioEvent({ profileId, event }));

  return NextResponse.json({ ok: true });
}
