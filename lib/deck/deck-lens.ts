// Deck v2 "Find in deck" panel: counts over the cards you bring to a match
// (maindeck + equipment + inventory — FaB is best-of-one, so the inventory is
// in play; never hero or bench) so a builder can see ratios like discard vs
// Gate at a glance. Type values match the ones the deck highlight
// (`deck-highlight-filter` stat 'type') understands, so a tally row can
// dispatch its own value.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { cardTextMatches } from './card-text-match'

type Details = NonNullable<DeckPrintingDTO['printingDetails']>

function playable(deck: DeckDTO): DeckPrintingDTO[] {
  return [...(deck.maindeck ?? []), ...(deck.equipment ?? []), ...(deck.inventory ?? [])]
}

export function countTextMatches(deck: DeckDTO, term: string): { copies: number; cards: number } {
  let copies = 0
  let cards = 0
  if (!term.trim()) return { copies, cards }
  for (const c of playable(deck)) {
    if (cardTextMatches(c.printingDetails?.text as string | undefined, term)) {
      copies += c.quantity ?? 1
      cards += 1
    }
  }
  return { copies, cards }
}

// "Opt 2" / "opt" → "opt": the numeric parameter isn't part of the keyword.
const keywordBase = (k: string) => k.replace(/\s+\d+$/, '').trim()

export function keywordTally(deck: DeckDTO): Array<{ keyword: string; copies: number }> {
  const tally = new Map<string, { keyword: string; copies: number; fromDisplay: boolean }>()
  for (const c of playable(deck)) {
    const d = c.printingDetails
    const display: string[] = Array.isArray(d?.keywords_display) ? d.keywords_display : []
    const fromDisplay = display.length > 0
    const words = fromDisplay ? display : Array.isArray(d?.keywords) ? (d.keywords as string[]) : []
    for (const word of new Set(words.map(keywordBase))) {
      const key = word.toLowerCase()
      const entry = tally.get(key)
      const label = fromDisplay ? word : word.charAt(0).toUpperCase() + word.slice(1)
      if (entry) {
        entry.copies += c.quantity ?? 1
        if (fromDisplay && !entry.fromDisplay) Object.assign(entry, { keyword: label, fromDisplay })
      } else {
        tally.set(key, { keyword: label, copies: c.quantity ?? 1, fromDisplay })
      }
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.copies - a.copies)
    .map(({ keyword, copies }) => ({ keyword, copies }))
}

const TYPE_BUCKETS: Array<{ value: string; label: string; test: (types: string[]) => boolean }> = [
  { value: 'attack', label: 'Attack', test: t => t.includes('action') && t.includes('attack') },
  { value: 'non-attack', label: 'Non-attack action', test: t => t.includes('action') && !t.includes('attack') },
  { value: 'instant', label: 'Instant', test: t => t.includes('instant') },
  { value: 'defense-reaction', label: 'Defense reaction', test: t => t.includes('defense reaction') },
  { value: 'attack-reaction', label: 'Attack reaction', test: t => t.includes('attack reaction') },
  { value: 'block', label: 'Block', test: t => t.includes('block') },
  { value: 'item', label: 'Item', test: t => t.includes('item') },
  { value: 'aura', label: 'Aura', test: t => t.includes('aura') },
  { value: 'ally', label: 'Ally', test: t => t.includes('ally') },
  { value: 'equipment', label: 'Equipment', test: t => t.includes('equipment') },
]

/** Does a card's type list fall in a type bucket (`'attack'`, `'defense-reaction'`, …)? */
export function typeBucketMatches(types: string[] | undefined, value: string): boolean {
  const lower = (types ?? []).map(t => t.toLowerCase())
  return TYPE_BUCKETS.find(b => b.value === value)?.test(lower) ?? false
}

/** Keyword names on a card, lowercased and without their numeric parameter ("Opt 2" → "opt"). */
export function cardKeywords(details: Details | undefined): string[] {
  const display: string[] = Array.isArray(details?.keywords_display) ? details.keywords_display : []
  const words = display.length ? display : Array.isArray(details?.keywords) ? (details.keywords as string[]) : []
  return words.map(w => keywordBase(w).toLowerCase())
}

export function typeTally(deck: DeckDTO): Array<{ value: string; label: string; copies: number }> {
  const counts = new Map<string, number>()
  for (const c of playable(deck)) {
    const types = ((c.printingDetails as Details | undefined)?.types ?? []).map(t => t.toLowerCase())
    for (const b of TYPE_BUCKETS) {
      if (b.test(types)) counts.set(b.value, (counts.get(b.value) ?? 0) + (c.quantity ?? 1))
    }
  }
  return TYPE_BUCKETS
    .filter(b => counts.has(b.value))
    .map(b => ({ value: b.value, label: b.label, copies: counts.get(b.value)! }))
    .sort((a, b) => b.copies - a.copies) // stable: ties keep bucket order
}

export function playableCount(deck: DeckDTO): number {
  return playable(deck).reduce((sum, c) => sum + (c.quantity ?? 1), 0)
}

// "12 vs 6" → "2 : 1"; the smaller side is the 1, one decimal at most.
export function formatRatio(a: number, b: number): string | null {
  if (a <= 0 || b <= 0) return null
  const fmt = (n: number) => String(Math.round(n * 10) / 10)
  return a >= b ? `${fmt(a / b)} : 1` : `1 : ${fmt(b / a)}`
}

export function pitchSplit(deck: DeckDTO): { red: number; yellow: number; blue: number; none: number; averageCost: number | null } {
  const split = { red: 0, yellow: 0, blue: 0, none: 0 }
  let costSum = 0
  let costed = 0
  for (const c of playable(deck)) {
    const qty = c.quantity ?? 1
    const p = c.printingDetails?.pitch
    if (p === 1) split.red += qty
    else if (p === 2) split.yellow += qty
    else if (p === 3) split.blue += qty
    else split.none += qty
    const cost = c.printingDetails?.cost
    if (typeof cost === 'number') { costSum += cost * qty; costed += qty }
  }
  return { ...split, averageCost: costed ? costSum / costed : null }
}

/** How the panel names a lens: '"discard" in text', 'Defense reaction', 'Go again'. */
export function lensLabel(lens: { stat: 'text' | 'type' | 'keyword'; value: string }): string {
  if (lens.stat === 'text') return `"${lens.value}" in text`
  if (lens.stat === 'type') return TYPE_BUCKETS.find(b => b.value === lens.value)?.label ?? lens.value
  return lens.value.charAt(0).toUpperCase() + lens.value.slice(1)
}

/** The type buckets as pickable options (value + label), in bucket order. */
export const TYPE_OPTIONS: Array<{ value: string; label: string }> = TYPE_BUCKETS.map(({ value, label }) => ({ value, label }))
