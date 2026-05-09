/**
 * Per-card validation predicates for deck operations.
 *
 * Pure functions — return { ok: true } or { ok: false, reason: string } where
 * `reason` is a short human-readable message suitable for surfacing back to the
 * MCP client (or other API consumer) on a per-card basis.
 */

export interface HeroLegality {
  classes: string[];
  talents: string[];
  essences?: string[];
}

export interface CardLegalityFields {
  classes: string[] | null;
  talents: string[] | null;
}

export type Predicate = { ok: true } | { ok: false; reason: string };

// Verifies card.classes ⊆ (generic + hero classes + hero talents + hero essences)
// AND card.talents ⊆ (hero talents + hero essences).
//
// Mirrors the same predicate used by PostgresPrintingsService precise-mode hero
// filter so search and add stay in sync.
export function validateCardForHero(card: CardLegalityFields, hero: HeroLegality): Predicate {
  const heroEssences = hero.essences ?? [];
  const allowedClasses = new Set<string>(['generic', ...hero.classes, ...hero.talents, ...heroEssences]);
  const allowedTalents = new Set<string>([...hero.talents, ...heroEssences]);

  const cardClasses = card.classes ?? [];
  const cardTalents = card.talents ?? [];

  if (cardClasses.length > 0) {
    const overlap = cardClasses.some(c => allowedClasses.has(c));
    if (!overlap) {
      const offending = cardClasses[0];
      return { ok: false, reason: heroLegalityReason('class', offending, hero) };
    }
  }

  if (cardTalents.length > 0) {
    const offending = cardTalents.find(t => !allowedTalents.has(t));
    if (offending !== undefined) {
      return { ok: false, reason: heroLegalityReason('talent', offending, hero) };
    }
  }

  return { ok: true };
}

function heroLegalityReason(kind: 'class' | 'talent', offending: string, hero: HeroLegality): string {
  const heroParts = [hero.classes.join('/'), hero.talents.join('/'), (hero.essences ?? []).join('/')]
    .filter(Boolean);
  return `${kind} "${offending}" not legal — hero plays [${heroParts.join(' + ')}]`;
}

// Format-specific maximum-copy rule.
//
// Returns ok if `newTotalCount` (existing + adding) is within the format's
// per-card limit. The "unlimited" keyword exempts a card from the limit.
// Living Legend treats 'legendary'-keyword cards and llRestricted cards as
// 1-of. Casual/Limited/UPF apply no limit.
export function validateCopyLimit(
  newTotalCount: number,
  format: string,
  card: { keywords?: string[] | null; llRestricted?: boolean },
): Predicate {
  const keywordsLower = (card.keywords ?? []).map(k => k.toLowerCase());
  if (keywordsLower.includes('unlimited')) return { ok: true };

  const f = format.toLowerCase();

  if (f === 'casual' || f === 'limited' || f === 'ultimate pit fight') {
    return { ok: true };
  }

  if (f === 'living legend') {
    if (card.llRestricted && newTotalCount > 1) {
      return { ok: false, reason: `restricted in Living Legend (max 1, would be ${newTotalCount})` };
    }
    if (keywordsLower.includes('legendary') && newTotalCount > 1) {
      return { ok: false, reason: `legendary cards limited to 1 (would be ${newTotalCount})` };
    }
    if (newTotalCount > 3) {
      return { ok: false, reason: `Living Legend allows max 3 copies (would be ${newTotalCount})` };
    }
    return { ok: true };
  }

  if (f === 'classic constructed') {
    if (newTotalCount > 3) {
      return { ok: false, reason: `Classic Constructed allows max 3 copies (would be ${newTotalCount})` };
    }
    return { ok: true };
  }

  // Silver Age, Blitz, Commoner — 2-of formats
  if (newTotalCount > 2) {
    const label = format;
    return { ok: false, reason: `${label} allows max 2 copies per card+pitch (would be ${newTotalCount})` };
  }
  return { ok: true };
}
