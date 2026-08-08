/**
 * Pure planning helpers for scripts/upgrade-image-resolution.ts — upgrading
 * low-resolution Cloudflare images in place from CardVault's `large` renditions.
 *
 * Key derivation is empirical (established against Rosetta, 2026-08):
 *  - Most deterministic image keys match a CardVault print code exactly
 *    (`media/cards/large/<key>.webp`).
 *  - Our doubled `-EA-EA` suffix (art_variations {EA} + is_extended_art both
 *    appending EA) does not exist on CardVault — the plain code IS the
 *    extended-art image for those cycles.
 *  - Cold-foil printings (`-CF…`) are published as Marvels: `<collector>-MV`.
 */

export interface SourceClaim {
  /** Our Cloudflare image key (5th path segment of image_url). */
  key: string;
  /** The CardVault key it resolved to. */
  source: string;
}

/**
 * Candidate CardVault `large` keys to try for a Cloudflare image key, in
 * order. Empty array = not derivable (nanoid printing_id fallback keys).
 */
export function candidateSourceKeys(imageKey: string): string[] {
  // LSS-style keys are upper-case alnum segments: optional `XX_` language
  // prefix, a set+collector base (2-4 letter set code, optionally
  // digit-leading, + number), then dash-joined suffixes. Anything else —
  // in particular 21-char mixed-case nanoids — is not derivable.
  // Suffixes normally attach with a dash; hero back faces may attach `_BACK`
  // directly to the base (UPR006_BACK).
  const m = imageKey.match(/^([A-Z]{2}_)?([0-9]?[A-Z]{2,4}[0-9]{2,4}[A-Z]?)((?:-|_)[A-Z0-9_-]+)?$/);
  if (!m) return [];
  const lang = m[1] ?? "";
  const base = m[2];
  const suffix = m[3] ?? "";

  const candidates = [imageKey];
  let rest = suffix;

  // UNLIMITED printings have no CardVault art at all: CardVault publishes one
  // image per card and it is the first-edition/alpha printing (verified by
  // diffing the edition symbol — see upgrade-plan.test.ts). Deriving anything
  // here would dress an Unlimited row in first-edition art, so stop.
  // Unlimited is sourced from the feed's `U-`-prefixed images instead.
  if (/-UL(-|$)/.test(rest)) return candidates;

  // First-edition / alpha keys carry an edition token CardVault omits. Drop it
  // (it can sit mid-suffix, e.g. EVR021-RF-EA-1E-EA) and keep going, so the
  // rules below still apply to the reduced key.
  if (/-(1E|AL)(-|$)/.test(rest)) {
    rest = rest.replace(/-(1E|AL)(?=-|$)/, "");
    candidates.push(`${lang}${base}${rest}`);
  }

  // CardVault has no doubled extended-art suffix — strip it and retry.
  if (rest.endsWith("-EA-EA")) {
    rest = rest.slice(0, -"-EA-EA".length);
    candidates.push(`${lang}${base}${rest}`);
  }

  // Cold foils are published as Marvels under the bare collector + -MV.
  if (/-CF(-|$)/.test(rest)) {
    candidates.push(`${lang}${base}-MV`);
  }

  return [...new Set(candidates)];
}

/** Identity of a printing for feed-claim conflict detection (foiling excluded). */
export interface FeedClaimRow {
  collector: string;
  edition: string;
  artVariations: string[];
  isFrontFace: boolean;
}

export interface FeedClaim {
  key: string;
  source: string;
  rows: FeedClaimRow[];
}

/**
 * Decide which feed-sourced claims are safe to apply.
 *
 * The fab-cube feed publishes ONE image per (card, edition, art variant) and
 * reuses it across finishes — foiling is a physical treatment over identical
 * art (ELE003 standard and cold foil both point at ELE003.width-450.png). So
 * several image keys legitimately share a source. What must never share one is
 * a different edition (unlimited vs first edition are visibly different
 * cards), a different art variant, or the opposite face — there, one claimant
 * would be wearing the other's art.
 */
export function resolveFeedClaims(claims: FeedClaim[]): {
  accepted: FeedClaim[];
  rejected: FeedClaim[];
} {
  const identity = (r: FeedClaimRow) =>
    `${r.collector}|${r.edition}|${[...r.artVariations].map((v) => v.toUpperCase()).sort().join(",")}|${r.isFrontFace}`;

  const bySource = new Map<string, FeedClaim[]>();
  for (const c of claims) {
    if (!bySource.has(c.source)) bySource.set(c.source, []);
    bySource.get(c.source)!.push(c);
  }

  const accepted: FeedClaim[] = [];
  const rejected: FeedClaim[] = [];
  for (const group of bySource.values()) {
    const identities = new Set(group.flatMap((c) => c.rows.map(identity)));
    if (group.length === 1 || identities.size === 1) accepted.push(...group);
    else rejected.push(...group);
  }
  return { accepted, rejected };
}

/**
 * Enforce that no source image is claimed by two different keys. A contested
 * source means at least one claimant would get the wrong art — reject every
 * fallback claimant of that source rather than guess. Self-claims
 * (key === source, i.e. direct hits) are always accepted: keys are unique, so
 * they cannot truly collide; any fallback claim on such a source is rejected.
 */
export function resolveFallbackClaims(claims: SourceClaim[]): {
  accepted: SourceClaim[];
  collided: SourceClaim[];
} {
  const claimants = new Map<string, number>();
  for (const c of claims) {
    claimants.set(c.source, (claimants.get(c.source) ?? 0) + 1);
  }
  const accepted: SourceClaim[] = [];
  const collided: SourceClaim[] = [];
  for (const c of claims) {
    const isSelf = c.key === c.source;
    if (isSelf || claimants.get(c.source) === 1) accepted.push(c);
    else collided.push(c);
  }
  return { accepted, collided };
}
