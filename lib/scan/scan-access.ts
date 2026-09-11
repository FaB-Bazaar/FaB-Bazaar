// lib/scan/scan-access.ts — who may use the card scanner (/scan + /api/scan/*).
// Pure and client-safe (navbar + page import it). Server routes go through
// lib/scan/require-scan-access.ts, which resolves the caller's roles first.
//
// ROLLOUT SWITCH: superadmin-only while the feature is being tested on
// production; flip SCAN_ROLLOUT to 'everyone' (and the pinned expectation in
// scan-access.test.ts) to open it to every signed-in user. Nothing else changes.

export type ScanRollout = 'superadmin' | 'everyone';
export const SCAN_ROLLOUT: ScanRollout = 'superadmin';

export interface ScanAccessFlags {
  isSuperAdmin?: boolean;
}

/** null/undefined flags = signed out → never. */
export function canUseScannerUnder(rollout: ScanRollout, flags: ScanAccessFlags | null | undefined): boolean {
  if (!flags) return false;
  if (rollout === 'superadmin') return !!flags.isSuperAdmin;
  return true;
}

export function canUseScanner(flags: ScanAccessFlags | null | undefined): boolean {
  return canUseScannerUnder(SCAN_ROLLOUT, flags);
}
