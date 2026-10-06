// Next.js server boot hook. Loads the runtime set overlay (sets registered in
// the DB after this build — lib/fab-constants/set-overlay.ts) and keeps it
// fresh, so route handlers and server components see new sets without a
// deploy. Never during `next build` (CI has no database).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { refreshSetOverlay } = await import('./lib/fab-constants/set-overlay-server');
  await refreshSetOverlay();
  const timer = setInterval(() => { void refreshSetOverlay(); }, 60_000);
  timer.unref?.();
}
