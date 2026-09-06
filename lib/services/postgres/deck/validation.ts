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

// Map the display-name format stored on decks (e.g. "Silver Age") to the
// snake_case enum used by other format-aware utilities (e.g. validateHeroFormatLegality).
// Returns undefined for free-form formats with no hero-age constraint.
export function deckFormatToSnake(format: string | null | undefined): string | undefined {
  if (!format) return undefined;
  switch (format) {
    case 'Silver Age': return 'silver_age';
    case 'Blitz': return 'blitz';
    case 'Commoner': return 'commoner';
    case 'Classic Constructed': return 'cc';
    case 'Future Classic Constructed': return 'future_cc';
    case 'Living Legend': return 'll';
    default: return undefined;
  }
}

// Card-level format legality flag check. Each format has a boolean column
// (silverAgeLegal, ccLegal, blitzLegal, commonerLegal, llLegal) on cards that
// is true when the card has at least one printing at a format-legal rarity
// (e.g. a Marvel-rarity printing of a card that also has a Common printing
// is fine — silverAgeLegal stays true for that card).
type FormatLegalFields = {
  silverAgeLegal?: boolean;
  ccLegal?: boolean;
  /** Derived: ccLegal OR printed in a not-yet-released set (lib/services/postgres/future-release.ts). */
  futureCcLegal?: boolean;
  blitzLegal?: boolean;
  commonerLegal?: boolean;
  llLegal?: boolean;
};

const FORMAT_LEGAL_FIELD: Record<string, keyof FormatLegalFields> = {
  'Silver Age': 'silverAgeLegal',
  'Classic Constructed': 'ccLegal',
  'Future Classic Constructed': 'futureCcLegal',
  'Blitz': 'blitzLegal',
  'Commoner': 'commonerLegal',
  'Living Legend': 'llLegal',
};

export function validateFormatLegal(card: FormatLegalFields, format: string): Predicate {
  const field = FORMAT_LEGAL_FIELD[format];
  if (!field) return { ok: true };
  const flag = card[field];
  if (flag === undefined) return { ok: true }; // missing data — skip rather than reject
  if (flag === false) return { ok: false, reason: `not legal in ${format}` };
  return { ok: true };
}

type FormatSuspendedFields = {
  silverAgeSuspended?: boolean;
  ccSuspended?: boolean;
  blitzSuspended?: boolean;
  commonerSuspended?: boolean;
};

const FORMAT_SUSPENDED_FIELD: Record<string, keyof FormatSuspendedFields> = {
  'Silver Age': 'silverAgeSuspended',
  'Classic Constructed': 'ccSuspended',
  'Future Classic Constructed': 'ccSuspended',
  'Blitz': 'blitzSuspended',
  'Commoner': 'commonerSuspended',
};

export function validateNotSuspended(card: FormatSuspendedFields, format: string): Predicate {
  const field = FORMAT_SUSPENDED_FIELD[format];
  if (!field) return { ok: true }; // Living Legend / free-form: no suspended concept
  const flag = card[field];
  if (flag === true) return { ok: false, reason: `suspended in ${format}` };
  return { ok: true };
}

export function validateNotBanned(
  cardUniqueId: string | null | undefined,
  bannedSet: Set<string>,
): Predicate {
  if (!cardUniqueId) return { ok: true };
  if (bannedSet.has(cardUniqueId)) {
    return { ok: false, reason: 'banned in this format' };
  }
  return { ok: true };
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

  if (f === 'classic constructed' || f === 'future classic constructed') {
    if (newTotalCount > 3) {
      return { ok: false, reason: `${format} allows max 3 copies (would be ${newTotalCount})` };
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
