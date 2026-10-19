'use client';

import { useEffect } from 'react';

export default function ViewTracker({ profileId }: { profileId: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId,
        referrer: document.referrer,
        utm: {
          source: params.get('utm_source'),
          medium: params.get('utm_medium'),
          campaign: params.get('utm_campaign'),
        },
      }),
      keepalive: true,
    }).catch(() => {});
  }, [profileId]);

  return null;
}
