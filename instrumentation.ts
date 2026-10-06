// Next.js server boot hook. Loads the runtime set overlay (sets registered in
// the DB after this build — lib/fab-constants/set-overlay.ts) and keeps it
// fresh, so route handlers and server components see new sets without a
// deploy. Never during `next build` (CI has no database).
//
// The import MUST sit inside the NEXT_RUNTIME check (Next's documented
// pattern): this file is also compiled for the edge runtime, and an early
// `return` does not keep the service layer out of that bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startSetOverlayRefresh } = await import('./instrumentation-node');
    await startSetOverlayRefresh();
  }
}
