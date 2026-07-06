// Single source of truth for who may use Volzar. Shared by the page server
// gate (app/volzar/page.tsx), the API route gates (/api/volzar
// [+ /confirm]), and navbar link visibility — keep them all calling this so the
// access rule lives in exactly one place.
//
// Rule: superadmins always, plus anyone on the paid Metafy supporter tier
// (users.metafy_supporter_tier === 'paid'), plus anyone a superadmin has
// manually granted (users.volzar_access — the non-Metafy comp path). The
// ads-only isMetafySupporter boolean is intentionally NOT part of this gate.

import type { SupporterTier } from '@/lib/metafy/supporter-tier';

export interface VolzarAccessFlags {
  isSuperAdmin?: boolean;
  metafySupporterTier?: SupporterTier | null;
  /** Manual superadmin grant, independent of Metafy. */
  volzarAccess?: boolean | null;
}

export function canUseVolzar(flags: VolzarAccessFlags | null | undefined): boolean {
  if (!flags) return false;
  return !!flags.isSuperAdmin || flags.metafySupporterTier === 'paid' || !!flags.volzarAccess;
}
