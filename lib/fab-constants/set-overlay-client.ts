// lib/fab-constants/set-overlay-client.ts — how a browser tab (and the SSR
// pass of client components) adopts the runtime set overlay. Two sources:
// the overlay the root layout rendered with, and a later /api/sets/overlay
// fetch (pages built before a set registration carry a stale one). The layout
// prop only wins when it CHANGES — a provider re-render with the same prop
// must not undo a newer fetched overlay.
import { applySetOverlay, currentSetOverlay, type SetOverlay } from './set-overlay';

let lastLayoutVersion: string | null = null;

export function adoptLayoutOverlay(overlay: SetOverlay): void {
  if (overlay.version === lastLayoutVersion) return;
  lastLayoutVersion = overlay.version;
  applySetOverlay(overlay);
}

export function adoptFetchedOverlay(overlay: SetOverlay | null | undefined): void {
  if (!overlay?.version || !overlay.meta || !overlay.images) return;
  const changed = overlay.version !== currentSetOverlay().version;
  applySetOverlay(overlay);
  if (changed) for (const l of [...listeners]) l();
}

// A prerendered page renders (and hydrates) with the compiled snapshot; the
// fetched overlay only reaches it if something re-renders it. Pages that list
// sets subscribe through useSetOverlayVersion (components/SetOverlayProvider).
const listeners = new Set<() => void>();

export function subscribeSetOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Version of the overlay published in this tab (useSyncExternalStore snapshot). */
export function setOverlayVersion(): string {
  return currentSetOverlay().version;
}

/** Tests only. */
export function __resetSetOverlayClientForTests(): void {
  lastLayoutVersion = null;
  listeners.clear();
}
