// Lazy, on-page-load refresh of a user's hosted-chat supporter tier.
//
// The /fabby-chat server gate calls this before checking access: if the user's
// cached Metafy membership is older than the TTL, we re-fetch memberships from
// Metafy (server-side, with their stored token), re-derive the tier, and
// persist it. A downgraded/cancelled supporter thus loses access the next time
// they open the page; a fresh cache skips the network call entirely.
//
// Safety: this NEVER revokes on a transient failure. We only write a (possibly
// lower) tier when Metafy definitively answers — token obtained AND memberships
// fetched OK. Missing token, network error, or non-2xx leaves the cached tier
// untouched, so a Metafy outage can't kick a paying user. Errors are swallowed
// (non-fatal) — the gate still runs on the last-known tier.

import { getValidMetafyAccessToken } from './tokens';
import { fabSupporterTier } from './supporter-tier';

const METAFY_MEMBERSHIPS_URL = 'https://metafy.gg/irk/api/v1/me/community/memberships';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function ttlMs(): number {
  const fromEnv = Number(process.env.METAFY_TIER_TTL_MS);
  return Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : DEFAULT_TTL_MS;
}

/**
 * Refresh the user's supporter tier from Metafy if their cached membership is
 * stale. No-ops (cheaply) for users without a linked Metafy account or with a
 * fresh cache. Safe to await on every page load — throttled by the TTL.
 */
export async function syncSupporterTierIfStale(
  userId: string,
  now: number = Date.now(),
): Promise<void> {
  try {
    const { userService } = await import('@/lib/services');

    const ctx = await userService.getSupporterSyncContext(userId);
    if (!ctx.success || !ctx.data?.linked) return; // not linked → nothing to sync

    // Fresh enough — serve the cached tier, skip the Metafy round-trip.
    if (ctx.data.syncedAt && now - ctx.data.syncedAt.getTime() < ttlMs()) return;

    const token = await getValidMetafyAccessToken(userId);
    if (!token) return; // can't verify right now — keep the cached tier

    let communities: { id: string; title: string; tiers?: { id: string; name: string }[] }[];
    try {
      const res = await fetch(METAFY_MEMBERSHIPS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // transient — do not revoke
      const data = await res.json();
      communities = data.communities ?? [];
    } catch {
      return; // network error — do not revoke
    }

    // Definitive answer from Metafy: refresh the cache and the derived tier.
    await userService.saveMetafyCommunities(
      userId,
      communities.map((c) => ({
        communityId: c.id,
        title: c.title,
        tiers: c.tiers?.map((t) => ({ id: t.id, name: t.name })) ?? null,
      })),
    );
    await userService.setMetafySupporterTier(userId, fabSupporterTier(communities));
  } catch (error) {
    // Non-fatal: the gate still runs on the last-known tier.
    console.error('[syncSupporterTierIfStale] error:', error);
  }
}
