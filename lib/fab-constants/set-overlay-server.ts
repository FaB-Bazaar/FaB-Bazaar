// lib/fab-constants/set-overlay-server.ts — server half of the runtime set
// registry (see set-overlay.ts). Loads the `sets` table, builds the overlay and
// publishes it to this process. Called by instrumentation.ts (boot + every
// minute), the root layout (per request, cached) and the set-registration
// route (immediately after a write). A failed DB read keeps the last good
// overlay — the compiled snapshot is the floor, never an error.
import { applySetOverlay, buildSetOverlay, currentSetOverlay, EMPTY_SET_OVERLAY, type SetOverlay, type SetRow } from './set-overlay';

type Loader = () => Promise<SetRow[]>;

const defaultLoader: Loader = async () => {
  // Lazy: lib/services must not load when this module is imported client-side
  // or from inside the service graph (circular-dep rule in CLAUDE.md).
  const { setsService } = await import('@/lib/services');
  const res = await setsService.listSets();
  if (!res.success) throw new Error(res.error);
  return res.data;
};

// Process-wide, like the overlay itself: Next.js keeps separate module copies.
const g = globalThis as unknown as { __fabSetOverlayLoadedAt?: number; __fabSetOverlayInflight?: Promise<SetOverlay> | null };

/** Reload from the DB now and publish. Returns the overlay in force afterwards. */
export async function refreshSetOverlay(loader: Loader = defaultLoader, now: () => number = Date.now): Promise<SetOverlay> {
  try {
    const overlay = buildSetOverlay(await loader());
    applySetOverlay(overlay);
    g.__fabSetOverlayLoadedAt = now();
  } catch (e) {
    console.error('[set-overlay] refresh failed — keeping the previous overlay:', e instanceof Error ? e.message : e);
    applySetOverlay(currentSetOverlay()); // still sync this module copy
  }
  return currentSetOverlay();
}

/** The overlay, reloading when older than ttlMs. Concurrent callers share one load. */
export async function getSetOverlay(
  { loader = defaultLoader, now = Date.now, ttlMs = 60_000 }: { loader?: Loader; now?: () => number; ttlMs?: number } = {},
): Promise<SetOverlay> {
  const loadedAt = g.__fabSetOverlayLoadedAt;
  if (loadedAt !== undefined && now() - loadedAt < ttlMs) {
    applySetOverlay(currentSetOverlay());
    return currentSetOverlay();
  }
  g.__fabSetOverlayInflight ??= refreshSetOverlay(loader, now).finally(() => { g.__fabSetOverlayInflight = null; });
  return g.__fabSetOverlayInflight;
}

/** Tests only. */
export function __resetSetOverlayServerForTests(): void {
  g.__fabSetOverlayLoadedAt = undefined;
  g.__fabSetOverlayInflight = null;
  applySetOverlay(EMPTY_SET_OVERLAY);
}
