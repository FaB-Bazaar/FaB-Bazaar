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
  // Not legal anywhere yet but printed in an unreleased set → Future CC (adult heroes only; it's a CC-rules format).
  if (hero.futureCcLegal && !hero.types.includes('young')) return 'Future Classic Constructed'
  return 'Classic Constructed'
}

// Mirrors the server's hero gate (FORMAT_HERO_REQUIREMENT in lib/fab-constants/heroes.ts):
// adult heroes → CC / Future CC / LL, young heroes → Silver Age / Blitz / Commoner.
// Limited is free-form, so any hero can play it.
const ADULT_HERO_FORMATS = ['Classic Constructed', 'Future Classic Constructed', 'Living Legend']
const YOUNG_HERO_FORMATS = ['Silver Age', 'Blitz', 'Commoner']
const FREE_FORM_FORMATS = ['Limited']

/**
 * Formats the create-deck dialog lets the user switch to for a hero. Only the
 * age split is enforced (same as the server) — legality flags pick the DEFAULT
 * (deriveFormatFromHero), they don't hide a format.
 */
export function formatOptionsForHero(hero: HeroLegalityRow | undefined): string[] {
  if (!hero) {
    return ['Classic Constructed', 'Future Classic Constructed', ...YOUNG_HERO_FORMATS, 'Living Legend', ...FREE_FORM_FORMATS]
  }
  const options = [
    ...(hero.types.includes('young') ? YOUNG_HERO_FORMATS : ADULT_HERO_FORMATS),
    ...FREE_FORM_FORMATS,
  ]
  const derived = deriveFormatFromHero(hero)
  return options.includes(derived) ? options : [derived, ...options]
}

/** The format a new deck is created with: the user's pick when the hero can play it, else the derived default. */
export function resolveDeckFormat(hero: HeroLegalityRow | undefined, picked: string | null): string {
  if (picked && formatOptionsForHero(hero).includes(picked)) return picked
  return deriveFormatFromHero(hero)
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
  if (format === 'Future Classic Constructed') return 'Future CC'
  if (format === 'Silver Age') return 'Sage'
  return format
}

/** Chip text for a hero restriction — Living Legend is format-agnostic. */
export function restrictionChipLabel(r: HeroRestriction): string {
  if (r.status === 'living_legend') return 'Living Legend'
  const verb = r.status === 'benched' ? 'Benched' : r.status === 'restricted' ? 'Restricted' : 'Banned'
  return `${verb} · ${formatShortLabel(r.format)}`
}
