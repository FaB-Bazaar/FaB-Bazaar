import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService'

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

/** Active banned hero card_unique_ids keyed by display format name. */
export type BannedHeroIdsByFormat = Record<string, Set<string>>

// CC and Silver Age are the primary formats of the game, so their chips sort
// first; the rest follow in descending relevance.
const FORMAT_ORDER = ['Classic Constructed', 'Silver Age', 'Blitz', 'Commoner', 'Living Legend']

/**
 * Every format the hero is banned in, regardless of its derived/playable format.
 * Used to annotate (not block) the hero picker with one chip per banned format —
 * a hero may be banned in CC (e.g. a Living Legend graduate) yet legal elsewhere.
 * Returned in FORMAT_ORDER (primary formats first).
 */
export function bannedFormatsForHero(
  hero: HeroLegalityRow,
  bannedByFormat: BannedHeroIdsByFormat,
): string[] {
  return Object.entries(bannedByFormat)
    .filter(([, ids]) => ids.has(hero.cardUniqueId))
    .map(([format]) => format)
    .sort((a, b) => {
      const ia = FORMAT_ORDER.indexOf(a)
      const ib = FORMAT_ORDER.indexOf(b)
      return (ia === -1 ? FORMAT_ORDER.length : ia) - (ib === -1 ? FORMAT_ORDER.length : ib)
    })
}

/** Short chip label for a display format name. */
export function formatShortLabel(format: string): string {
  if (format === 'Classic Constructed') return 'CC'
  if (format === 'Silver Age') return 'Sage'
  return format
}
