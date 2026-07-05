// Single source of truth for who may use Fabby Chat. Shared by the page server
// gate (app/fabby-chat/page.tsx), the API route gates (/api/fabby-chat
// [+ /confirm]), and navbar link visibility — keep them all calling this so the
// access rule lives in exactly one place.
//
// Rule: superadmins always, plus anyone on the paid Metafy supporter tier
// (users.metafy_supporter_tier === 'paid'). The ads-only isMetafySupporter
// boolean is intentionally NOT part of this gate.

import type { SupporterTier } from '@/lib/metafy/supporter-tier';

export interface FabbyChatAccessFlags {
  isSuperAdmin?: boolean;
  metafySupporterTier?: SupporterTier | null;
}

export function canUseFabbyChat(flags: FabbyChatAccessFlags | null | undefined): boolean {
  if (!flags) return false;
  return !!flags.isSuperAdmin || flags.metafySupporterTier === 'paid';
}
