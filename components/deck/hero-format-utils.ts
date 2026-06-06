import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService'
import type { RestrictionType } from '@/lib/services/contracts/IBannedCardsService'

/**
 * Derive the format a hero deck defaults to.
 * Priority: cc > silver_age > blitz > commoner > ll. CC is the default for
 * adult heroes, Silver Age for young, LL only for graduated heroes.
 */
export function deriveFormatFromHero(hero: HeroLegalityRow | undefined): string {
  if (!hero) return 'Classic Constructed'
  if (hero.ccLegal) return 'Classic Constructed'
  if (hero.silverAgeLegal) return 'Silver Age'
  if (hero.blitzLegal) return 'Blitz'
  if (hero.commonerLegal) return 'Commoner'
  if (hero.llLegal) return 'Living Legend'
  return 'Classic Constructed'
}

/** Hero restriction status (per format) keyed by card_unique_id. */
export type HeroRestrictionsByFormat = Record<string, Map<string, RestrictionType>>

/** A hero's restriction in one format. */
export interface HeroRestriction {
  format: string
  status: RestrictionType
}

// CC and Silver Age are the primary formats of the game, so their chips sort
// first; the rest follow in descending relevance.
const FORMAT_ORDER = ['Classic Constructed', 'Silver Age', 'Blitz', 'Commoner', 'Living Legend']

/**
 * Every format the hero is restricted in, with its status (banned / benched /
 * living_legend), regardless of its derived/playable format. Used to annotate
 * (not block) the hero picker — a hero may be a Living Legend graduate in CC yet
 * legal elsewhere. Returned in FORMAT_ORDER (primary formats first).
 */
export function heroRestrictions(
  hero: HeroLegalityRow,
  byFormat: HeroRestrictionsByFormat,
): HeroRestriction[] {
  const out: HeroRestriction[] = []
  for (const format of FORMAT_ORDER) {
    const status = byFormat[format]?.get(hero.cardUniqueId)
    if (status) out.push({ format, status })
  }
  return out
}

/** Short chip label for a display format name. */
export function formatShortLabel(format: string): string {
  if (format === 'Classic Constructed') return 'CC'
  if (format === 'Silver Age') return 'Sage'
  return format
}

/** Chip text for a hero restriction — Living Legend is format-agnostic. */
export function restrictionChipLabel(r: HeroRestriction): string {
  if (r.status === 'living_legend') return 'Living Legend'
  const verb = r.status === 'benched' ? 'Benched' : r.status === 'restricted' ? 'Restricted' : 'Banned'
  return `${verb} · ${formatShortLabel(r.format)}`
}
