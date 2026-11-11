'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { SetOverlay } from '@/lib/fab-constants/set-overlay';
import {
  adoptFetchedOverlay, adoptLayoutOverlay, subscribeSetOverlay, setOverlayVersion,
} from '@/lib/fab-constants/set-overlay-client';

/**
 * Re-renders the calling component when the fetched overlay replaces the one
 * the page was built with. A prerendered page that lists sets or shows set
 * logos needs it — without it the page keeps the compiled snapshot until the
 * next navigation (/sets showed a broken Outbreak logo this way).
 */
export function useSetOverlayVersion(): string {
  return useSyncExternalStore(subscribeSetOverlay, setOverlayVersion, setOverlayVersion);
}

/**
 * Patches the set constants with the DB set overlay (sets registered after
 * this build — lib/fab-constants/set-overlay.ts) BEFORE its children render,
 * so filter chips, set names and logos include them. Statically built pages
 * carry an empty overlay, so the tab also asks the server once.
 */
export function SetOverlayProvider({ overlay, children }: { overlay: SetOverlay; children: React.ReactNode }) {
  adoptLayoutOverlay(overlay);

  useEffect(() => {
    fetch('/api/sets/overlay')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => adoptFetchedOverlay(j?.data))
      .catch(() => {});
  }, []);

  return <>{children}</>;
}
