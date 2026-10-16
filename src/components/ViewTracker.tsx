'use client';

import { useEffect } from 'react';

export default function ViewTracker({ profileId }: { profileId: string }) {
  useEffect(() => {
    fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {});
  }, [profileId]);

  return null;
}
