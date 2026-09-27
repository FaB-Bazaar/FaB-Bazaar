// Deck v2 "Brew" tab: the deck's legal pool minus what's already in the deck.
// The left panel's lens (text / type / keyword) narrows the pool with the same
// meaning it has when highlighting the deck.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService'
import type { Lens } from './deck-table'
import type { HeroFilter } from './resolve-hero-filter'

// Type buckets (deck-lens TYPE_BUCKETS) expressed as server filters:
// `types` = one OR overlap, `subtypes` = a second ANDed overlap, `typesNot` excludes.
const TYPE_FILTERS: Record<string, Pick<PrintingsSearchFilters, 'types' | 'subtypes' | 'typesNot'>> = {
  'attack': { types: ['action'], subtypes: ['attack'] },
  'non-attack': { types: ['action'], typesNot: ['attack'] },
  'defense-reaction': { types: ['defense reaction'] },
  'attack-reaction': { types: ['attack reaction'] },
}

export function lensToSearchFilters(lens: Lens | null): Partial<PrintingsSearchFilters> {
  if (!lens) return {}
  if (lens.stat === 'text') return { text: lens.value }
  if (lens.stat === 'keyword') return { keywords: [lens.value] }
  return TYPE_FILTERS[lens.value] ?? { types: [lens.value] }
}

/** Search results (grouped by card) minus cards already anywhere in the deck — bench included.
 *  `keep`: cards added during this Brew session stay put (with their badge)
 *  instead of vanishing from under the cursor. */
export function notInDeck<T extends { unique_id: string }>(results: T[], deck: DeckDTO, keep?: Set<string>): T[] {
  const inDeck = new Set<string>()
  for (const zone of ['hero', 'equipment', 'maindeck', 'inventory', 'benched'] as const) {
    for (const c of ((deck[zone] as DeckPrintingDTO[] | undefined) ?? [])) {
      const id = c.printingDetails?.card_unique_id as string | undefined
      if (id) inDeck.add(id)
    }
  }
  return results.filter(r => keep?.has(r.unique_id) || !inDeck.has(r.unique_id))
}

const DECK_ZONES = ['hero', 'equipment', 'maindeck', 'inventory', 'benched'] as const
type DeckZone = (typeof DECK_ZONES)[number]

/** Copies of one card per zone, for a Brew tile's badge; `printingId` is the
 *  printing an undo removes a copy of (the last one listed in that zone). */
export function deckCopiesByZone(deck: DeckDTO, cardUniqueId: string): Array<{ zone: DeckZone; qty: number; printingId: string }> {
  const out: Array<{ zone: DeckZone; qty: number; printingId: string }> = []
  for (const zone of DECK_ZONES) {
    let qty = 0
    let printingId = ''
    for (const c of ((deck[zone] as DeckPrintingDTO[] | undefined) ?? [])) {
      if (c.printingDetails?.card_unique_id !== cardUniqueId) continue
      qty += c.quantity ?? 1
      printingId = c.printingId
    }
    if (qty > 0) out.push({ zone, qty, printingId })
  }
  return out
}

/** Every loaded card sharing this card's name (its pitch variants), red → yellow → blue. */
export function pitchSiblings<T extends { name: string; pitch: number | null }>(cards: T[], card: T): T[] {
  return cards.filter(c => c.name === card.name).sort((a, b) => (a.pitch ?? 9) - (b.pitch ?? 9))
}

/** Brew-only picks, one per section, ANDed with each other and the lens. */
export interface BrewFacets {
  class?: string   // a hero class, or 'generic'
  talent?: string  // a hero talent, or 'talentless'
  rarity?: string  // rarity code: f l m s r c
}

export const RARITY_ROWS: Array<{ value: string; label: string }> = [
  { value: 'f', label: 'Fabled' },
  { value: 'l', label: 'Legendary' },
  { value: 'm', label: 'Majestic' },
  { value: 's', label: 'Super Rare' },
  { value: 'r', label: 'Rare' },
  { value: 'c', label: 'Common' },
]

const titleCase = (s: string) => s.replace(/\b\w/g, ch => ch.toUpperCase())

export function facetsToSearchFilters(f: BrewFacets): Partial<PrintingsSearchFilters> {
  const out: Partial<PrintingsSearchFilters> = {}
  if (f.class) out.classes = [f.class]
  if (f.talent === 'talentless') out.talentless = true
  else if (f.talent) out.talents = [f.talent]
  // printings.rarity: a card's regular printings carry its rarity (promo/marvel
  // reprints have their own codes), so this reads as the card's rarity.
  if (f.rarity) out.rarities = [f.rarity]
  return out
}

export function facetsLabel(f: BrewFacets): string {
  return [
    f.class && titleCase(f.class),
    f.talent && titleCase(f.talent),
    f.rarity && RARITY_ROWS.find(r => r.value === f.rarity)?.label,
  ].filter(Boolean).join(' · ')
}

type FacetRow = { value: string; label: string; copies: number }

/** Rows for the Brew panel's Class / Talent / Rarity sections, with what the
 *  deck already plays (main deck + equipment + inventory). */
export function brewFacetRows(deck: DeckDTO, hero: HeroFilter | null): { classes: FacetRow[]; talents: FacetRow[]; rarities: FacetRow[] } {
  const cards = [...(deck.maindeck ?? []), ...(deck.equipment ?? []), ...(deck.inventory ?? [])]
  const count = (test: (d: NonNullable<DeckPrintingDTO['printingDetails']>) => boolean) =>
    cards.reduce((n, c) => n + (c.printingDetails && test(c.printingDetails) ? c.quantity ?? 1 : 0), 0)
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x).toLowerCase()) : [])

  const heroClasses = (hero?.heroClasses ?? []).map(c => c.toLowerCase()).filter(c => c !== 'generic')
  const classes = [...heroClasses, 'generic'].map(value => ({
    value, label: titleCase(value), copies: count(d => list(d.classes).includes(value)),
  }))
  const heroTalents = (hero?.heroTalents ?? []).map(t => t.toLowerCase())
  const talents = heroTalents.length === 0 ? [] : [
    ...heroTalents.map(value => ({ value, label: titleCase(value), copies: count(d => list(d.talents).includes(value)) })),
    { value: 'talentless', label: 'Talentless', copies: count(d => list(d.talents).length === 0) },
  ]
  const rarities = RARITY_ROWS.map(r => ({ ...r, copies: count(d => String(d.rarity ?? '').toLowerCase() === r.value) }))
  return { classes, talents, rarities }
}
