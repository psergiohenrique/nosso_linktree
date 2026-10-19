import { NextResponse, after, type NextRequest } from "next/server";
import { trackEvent } from "@/server/analytics";
import { queryOne } from "@/server/db";
import { captureBioEvent } from "@/server/posthog-events";
import { safeUrl } from "@/lib/validation";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = new URL("/", request.url);
  if (!UUID.test(id)) return NextResponse.redirect(home);

  const link = await queryOne<{ id: string; profile_id: string; url: string; kind: string }>(
    "select id, profile_id, url, kind from links where id = $1 and is_active",
    [id],
  );
  const target = link ? safeUrl(link.url) : null;
  if (!link || !target) return NextResponse.redirect(home);

  // O referer aqui é a própria página de links; a origem real da visita fica no evento de visualização.
  const event = await trackEvent({
    profileId: link.profile_id,
    linkId: link.id,
    type: "click",
    headers: request.headers,
    referrer: null,
  });
  if (event) after(() => captureBioEvent({ profileId: link.profile_id, event, link: { id: link.id, kind: link.kind } }));

  return NextResponse.redirect(target, 302);
}
