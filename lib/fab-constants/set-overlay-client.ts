// lib/fab-constants/set-overlay-client.ts — how a browser tab (and the SSR
// pass of client components) adopts the runtime set overlay. Two sources:
// the overlay the root layout rendered with, and a later /api/sets/overlay
// fetch (pages built before a set registration carry a stale one). The layout
// prop only wins when it CHANGES — a provider re-render with the same prop
// must not undo a newer fetched overlay.
import { applySetOverlay, type SetOverlay } from './set-overlay';

let lastLayoutVersion: string | null = null;

export function adoptLayoutOverlay(overlay: SetOverlay): void {
  if (overlay.version === lastLayoutVersion) return;
  lastLayoutVersion = overlay.version;
  applySetOverlay(overlay);
}

export function adoptFetchedOverlay(overlay: SetOverlay | null | undefined): void {
  if (!overlay?.version || !overlay.meta || !overlay.images) return;
  applySetOverlay(overlay);
}

/** Tests only. */
export function __resetSetOverlayClientForTests(): void {
  lastLayoutVersion = null;
}
