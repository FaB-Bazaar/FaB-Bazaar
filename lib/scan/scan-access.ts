// lib/scan/scan-access.ts — who may use the card scanner (/scan + /api/scan/*).
// Pure and client-safe (navbar + page import it). Server routes go through
// lib/scan/require-scan-access.ts, which resolves the caller's roles first.
//
// ROLLOUT SWITCH: open to every signed-in user since 2026-10-11 (was
// superadmin-only while tested on production). Signed-out visitors never get in.
// Set back to 'superadmin' (and the pinned expectations in scan-access.test.ts
// and the scan route tests) to close it again.

export type ScanRollout = 'superadmin' | 'everyone';
export const SCAN_ROLLOUT: ScanRollout = 'everyone';

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
