// Node-only half of instrumentation.ts (kept in its own file so the edge
// bundle never pulls in the service layer — `crypto`, `pg`, …).
import { refreshSetOverlay } from './lib/fab-constants/set-overlay-server';

export async function startSetOverlayRefresh() {
  await refreshSetOverlay();
  const timer = setInterval(() => { void refreshSetOverlay(); }, 60_000);
  timer.unref?.();
}
