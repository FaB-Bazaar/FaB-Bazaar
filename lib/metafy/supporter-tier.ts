// Derives a hosted-chat supporter tier from a user's Metafy community
// memberships. A "paid" supporter is a member of the FaB Bazaar Metafy
// community at one of the paid tiers. The memberships payload is the same shape
// fetched in app/api/auth/metafy/callback and cached in the metafy_communities
// table (tiers jsonb). This is the pure derivation; persistence to
// users.metafy_supporter_tier happens at the call sites (callback / refresh).

export type SupporterTier = 'free' | 'paid';

/** One community entry from GET /irk/api/v1/me/community/memberships. */
export interface MetafyCommunityMembership {
  /** Metafy community id (NOT the @slug). */
  id: string;
  title?: string;
  tiers?: { id: string; name?: string }[] | null;
}

export interface SupporterTierConfig {
  /** The FaB Bazaar Metafy community id to look for. */
  communityId: string;
  /** Tier ids within that community that count as "paid". */
  paidTierIds: readonly string[];
}

/**
 * Pure core: returns 'paid' when `communities` shows membership in
 * `config.communityId` at one of `config.paidTierIds`, else 'free'.
 * Fail-safe: any missing/empty data resolves to 'free' (never grants paid).
 */
export function computeSupporterTier(
  communities: MetafyCommunityMembership[] | null | undefined,
  config: SupporterTierConfig,
): SupporterTier {
  if (!communities?.length) return 'free';
  const fab = communities.find((c) => c.id === config.communityId);
  if (!fab?.tiers?.length) return 'free';
  const paid = new Set(config.paidTierIds);
  return fab.tiers.some((t) => paid.has(t.id)) ? 'paid' : 'free';
}

// ---------------------------------------------------------------------------
// Real FaB Bazaar config — sourced from env, not hardcoded.
//
// These ids are NOT visible in the Metafy creator dashboard UI; they only
// appear in the /me/community/memberships payload the callback caches into the
// metafy_communities table (tiers jsonb). Read them from there when they change
// (a member must have linked their account), then set the env vars:
//   METAFY_FAB_COMMUNITY_ID   the community id (single value)
//   METAFY_FAB_PAID_TIER_IDS  comma-separated tier id(s) that count as paid
// While either is unset, fabSupporterTier() resolves to 'free' — access is
// never granted until both are configured. See .env.example for current values.
export const FAB_BAZAAR_COMMUNITY_ID = process.env.METAFY_FAB_COMMUNITY_ID ?? '';
export const FAB_BAZAAR_PAID_TIER_IDS: readonly string[] = (
  process.env.METAFY_FAB_PAID_TIER_IDS ?? ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** FaB-specific wrapper applying the real community/tier constants. */
export function fabSupporterTier(
  communities: MetafyCommunityMembership[] | null | undefined,
): SupporterTier {
  return computeSupporterTier(communities, {
    communityId: FAB_BAZAAR_COMMUNITY_ID,
    paidTierIds: FAB_BAZAAR_PAID_TIER_IDS,
  });
}
