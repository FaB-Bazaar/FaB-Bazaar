// Deck ratios (deck v2 Stats panel): user-defined "A : B" comparisons —
// discard : Gate, red : blue — or single measures ("Go again: 24 of 80"),
// saved per deck in decks.metadata.ratios. Counts cover the cards brought to a
// match (main deck + equipment + inventory), like the Find panel.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { cardTextMatches } from './card-text-match'
import { cardKeywords, formatRatio, keywordTally, lensLabel, playableCount, TYPE_OPTIONS, typeBucketMatches } from './deck-lens'

export type MeasureKind = 'text' | 'type' | 'keyword' | 'pitch'
export interface Measure { kind: MeasureKind; value: string }
export interface DeckRatio { id: string; a: Measure; b?: Measure }

const KINDS: MeasureKind[] = ['text', 'type', 'keyword', 'pitch']
const MAX_RATIOS = 20
const MAX_VALUE = 60
const PITCH_NAME: Record<string, string> = { '1': 'Red', '2': 'Yellow', '3': 'Blue' }

type Details = DeckPrintingDTO['printingDetails']

export function measureMatches(details: Details, m: Measure): boolean {
  if (m.kind === 'text') return cardTextMatches(details?.text as string | undefined, m.value)
  if (m.kind === 'type') return typeBucketMatches(details?.types, m.value)
  if (m.kind === 'keyword') return cardKeywords(details).includes(m.value.toLowerCase())
  return String(details?.pitch ?? '') === m.value
}

export function countMeasure(deck: DeckDTO, m: Measure): number {
  const cards = [...(deck.maindeck ?? []), ...(deck.equipment ?? []), ...(deck.inventory ?? [])]
  return cards.reduce((n, c) => n + (measureMatches(c.printingDetails, m) ? c.quantity ?? 1 : 0), 0)
}

export function measureLabel(m: Measure): string {
  if (m.kind === 'pitch') return PITCH_NAME[m.value] ?? `Pitch ${m.value}`
  if (m.kind === 'text') return `"${m.value}"`
  return lensLabel({ stat: m.kind, value: m.value })
}

export function ratioRow(r: DeckRatio, deck: DeckDTO): { label: string; value: string; note: string } {
  const a = countMeasure(deck, r.a)
  if (!r.b) {
    const total = playableCount(deck)
    return { label: measureLabel(r.a), value: `${a} of ${total}`, note: `${total ? Math.round((a / total) * 100) : 0}%` }
  }
  const b = countMeasure(deck, r.b)
  const value = `${a} : ${b}`
  const reduced = formatRatio(a, b) ?? '—'
  // "3 : 1 (3 : 1)" says nothing twice — only show the reduced form when it differs.
  return { label: `${measureLabel(r.a)} : ${measureLabel(r.b)}`, value, note: reduced === value ? '' : reduced }
}

function sanitizeMeasure(v: unknown): Measure | null {
  if (!v || typeof v !== 'object') return null
  const { kind, value } = v as Record<string, unknown>
  if (!KINDS.includes(kind as MeasureKind) || typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, MAX_VALUE)
  if (!trimmed) return null
  if (kind === 'pitch' && !PITCH_NAME[trimmed]) return null
  return { kind: kind as MeasureKind, value: trimmed }
}

/** Validate a client-supplied ratio list; null when it isn't a list at all. */
export function sanitizeRatios(input: unknown): DeckRatio[] | null {
  if (!Array.isArray(input)) return null
  const out: DeckRatio[] = []
  for (const item of input) {
    if (out.length >= MAX_RATIOS) break
    if (!item || typeof item !== 'object') continue
    const { id, a, b } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id || id.length > 40) continue
    const ma = sanitizeMeasure(a)
    if (!ma) continue
    const mb = b === undefined || b === null ? undefined : sanitizeMeasure(b)
    if (mb === null) continue
    out.push(mb ? { id, a: ma, b: mb } : { id, a: ma })
  }
  return out
}

export const KIND_NAME: Record<MeasureKind, string> = { text: 'card text', type: 'card type', keyword: 'keyword', pitch: 'pitch' }

export interface MeasureSuggestion { measure: Measure; label: string; kindName: string; count: number }

/**
 * What a typed word could mean, most specific first: a card type the deck has
 * ("item" → Item), a keyword the deck has ("boost" → Boost), a pitch colour
 * ("blue"), and always — last — the words as card text. So "Item" isn't
 * silently counted as text that mentions items.
 */
export function measureSuggestions(query: string, deck: DeckDTO): MeasureSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: MeasureSuggestion[] = []
  const push = (measure: Measure, onlyIfPresent: boolean) => {
    const count = countMeasure(deck, measure)
    if (onlyIfPresent && count === 0) return
    out.push({ measure, label: measureLabel(measure), kindName: KIND_NAME[measure.kind], count })
  }
  for (const t of TYPE_OPTIONS) if (t.label.toLowerCase().includes(q)) push({ kind: 'type', value: t.value }, true)
  for (const k of keywordTally(deck)) if (k.keyword.toLowerCase().includes(q)) push({ kind: 'keyword', value: k.keyword.toLowerCase() }, true)
  for (const [value, name] of Object.entries(PITCH_NAME)) if (name.toLowerCase().startsWith(q)) push({ kind: 'pitch', value }, true)
  push({ kind: 'text', value: query.trim() }, false)
  return out
}
