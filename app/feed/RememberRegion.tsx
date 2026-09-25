'use client';

import { useEffect } from 'react';
import { FEED_REGION_COOKIE, type FeedRegion } from '@/lib/market-feed/region';

/** Remembers a region the viewer explicitly picked, so /feed opens on it next time. */
export function RememberRegion({ region }: { region: FeedRegion }) {
  useEffect(() => {
    document.cookie = `${FEED_REGION_COOKIE}=${region}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [region]);
  return null;
}
