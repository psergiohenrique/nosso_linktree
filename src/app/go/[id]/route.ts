import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { safeUrl } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const home = new URL('/', request.url);
  if (!UUID.test(params.id)) return NextResponse.redirect(home);

  const supabase = createPublicClient();
  const { data: link } = await supabase
    .from('links')
    .select('id, profile_id, url')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle();

  const target = link ? safeUrl(link.url) : null;
  if (!link || !target) return NextResponse.redirect(home);

  const device = /mobile|android|iphone/i.test(request.headers.get('user-agent') ?? '') ? 'mobile' : 'desktop';
  await supabase.rpc('track_event', {
    p_profile: link.profile_id,
    p_link: link.id,
    p_type: 'click',
    p_referrer: request.headers.get('referer'),
    p_device: device,
  });

  return NextResponse.redirect(target, 302);
}
