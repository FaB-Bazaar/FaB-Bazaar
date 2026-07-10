// Single source of truth for who may use Volzar. Shared by the page server
// gate (app/volzar/page.tsx), the API route gates (/api/volzar
// [+ /confirm]), and navbar link visibility — keep them all calling this so the
// access rule lives in exactly one place.
//
// Rule (since 2026-07): Volzar is standard for every signed-in user — the
// gate only distinguishes signed-in (flags present) from signed-out
// (null/undefined). Cost control lives in the daily message limits
// (lib/ai/tiers.ts), NOT here. The flags interface is kept because callers
// still pass their session/DB flags and the chat route reads isSuperAdmin
// off it (model picking + quota exemption).

import type { SupporterTier } from '@/lib/metafy/supporter-tier';

export interface VolzarAccessFlags {
  isSuperAdmin?: boolean;
  metafySupporterTier?: SupporterTier | null;
  /** Manual superadmin grant, independent of Metafy (pre-2026-07 comp path). */
  volzarAccess?: boolean | null;
}

export function canUseVolzar(flags: VolzarAccessFlags | null | undefined): boolean {
  return !!flags;
}
