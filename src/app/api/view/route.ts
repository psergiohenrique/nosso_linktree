import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const profileId = body?.profileId;
  if (typeof profileId !== 'string' || !UUID.test(profileId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const referrer = typeof body.referrer === 'string' ? body.referrer : null;
  const device = /mobile|android|iphone/i.test(request.headers.get('user-agent') ?? '') ? 'mobile' : 'desktop';

  await createPublicClient().rpc('track_event', {
    p_profile: profileId,
    p_link: null,
    p_type: 'view',
    p_referrer: referrer,
    p_device: device,
  });

  return NextResponse.json({ ok: true });
}
