/**
 * Plan a format-legality backfill from the fab-cube feed onto `cards`.
 *
 * Why this exists: a set ingested from CardVault during spoiler season creates
 * `cards` rows with the schema default (every *_legal flag false). When
 * fab-cube later publishes the set, pipeline 005 ADOPTS those rows in place —
 * but the legality columns sit in CARD_ADMIN_OWNED_COLS, so ON CONFLICT never
 * overwrites them. The feed's `cc_legal: true` never lands and the spoiler-era
 * `false` is frozen forever. MPW shipped that way: 67 cards unplayable in CC,
 * 60 in Silver Age, on prod.
 *
 * Matching is by `fab_cube_card_id` ONLY. Name/pitch lookalikes are exactly
 * where spoiler-era rows and the feed disagree (MPW's Crimson Waltz is pitch 1
 * for us and pitch 2 upstream), so an unanchored row is reported, never
 * guessed at.
 *
 * Direction: the plan syncs flags BOTH ways for the sets it is pointed at —
 * those cards were never curated, so the feed is the authority. Downward flips
 * are counted separately so a caller can refuse to apply them silently.
 */

export const LEGALITY_FLAGS = [
  'cc_legal',
  'silver_age_legal',
  'blitz_legal',
  'commoner_legal',
  'll_legal',
] as const;

export type LegalityFlag = (typeof LEGALITY_FLAGS)[number];
export type LegalityFlags = Record<LegalityFlag, boolean>;

export interface DbCardRow {
  cardUniqueId: string;
  name: string;
  pitch: number | null;
  fabCubeCardId: string | null;
  flags: LegalityFlags;
}

/** The subset of a fab-cube card doc this planner reads. */
export type FeedLegality = { unique_id: string; name: string } & LegalityFlags;

export interface LegalityUpdate {
  cardUniqueId: string;
  name: string;
  pitch: number | null;
  /** Full target state — every flag, so the UPDATE is idempotent. */
  flags: LegalityFlags;
  /** Flags going false → true. */
  grants: LegalityFlag[];
  /** Flags going true → false. */
  revocations: LegalityFlag[];
}

export interface UnmatchedCard {
  cardUniqueId: string;
  name: string;
  pitch: number | null;
  reason: 'no-anchor' | 'not-in-feed';
}

export interface LegalityPlan {
  updates: LegalityUpdate[];
  unmatched: UnmatchedCard[];
  /** Cards already agreeing with the feed. */
  unchanged: number;
  /** Total flags going true → false across the plan. */
  revocationCount: number;
}

export function planLegalityBackfill(
  rows: DbCardRow[],
  feed: FeedLegality[],
): LegalityPlan {
  const byFeedId = new Map(feed.map((c) => [c.unique_id, c]));

  const updates: LegalityUpdate[] = [];
  const unmatched: UnmatchedCard[] = [];
  let unchanged = 0;
  let revocationCount = 0;

  for (const row of rows) {
    const ident = { cardUniqueId: row.cardUniqueId, name: row.name, pitch: row.pitch };

    if (!row.fabCubeCardId) {
      unmatched.push({ ...ident, reason: 'no-anchor' });
      continue;
    }
    const feedCard = byFeedId.get(row.fabCubeCardId);
    if (!feedCard) {
      unmatched.push({ ...ident, reason: 'not-in-feed' });
      continue;
    }

    const flags = {} as LegalityFlags;
    const grants: LegalityFlag[] = [];
    const revocations: LegalityFlag[] = [];
    for (const flag of LEGALITY_FLAGS) {
      const target = feedCard[flag] === true;
      flags[flag] = target;
      if (target === row.flags[flag]) continue;
      if (target) grants.push(flag);
      else revocations.push(flag);
    }

    if (grants.length === 0 && revocations.length === 0) {
      unchanged++;
      continue;
    }
    revocationCount += revocations.length;
    updates.push({ ...ident, flags, grants, revocations });
  }

  return { updates, unmatched, unchanged, revocationCount };
}
