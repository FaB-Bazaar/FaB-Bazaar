'use client';

import { useEffect } from 'react';
import type { SetOverlay } from '@/lib/fab-constants/set-overlay';
import { adoptFetchedOverlay, adoptLayoutOverlay } from '@/lib/fab-constants/set-overlay-client';

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
