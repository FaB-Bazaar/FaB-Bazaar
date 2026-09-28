// Deck highlight filters (the `deck-highlight-filter` events from Cmd+K chords
// and the Deck panel): how the filter list changes per event, and whether a
// card matches it — OR within one stat, AND across stats. Shared by the card
// grid (DeckEditorListView) and deck v2's Table so both highlight the same cards.

import { cardTextMatches } from './card-text-match'

export type HighlightFilter = { stat: string; value: number | string }
export interface HighlightEvent { stat: string; value: number | string; additive?: boolean }

export function applyHighlightEvent(
  prev: HighlightFilter[],
  { stat, value, additive }: HighlightEvent,
  { multiPerStat = false }: { multiPerStat?: boolean } = {},
): HighlightFilter[] {
  if (additive) {
    // Chord ranges (e.g. power 4-6): add without replacing same-stat filters
    return prev.some(f => f.stat === stat && f.value === value) ? prev : [...prev, { stat, value }]
  }
  // Same filter again — remove it
  if (prev.some(f => f.stat === stat && f.value === value)) return prev.filter(f => !(f.stat === stat && f.value === value))
  // Hover mode: several values per stat (OR)
  if (multiPerStat) return [...prev, { stat, value }]
  // Different value for the same stat — replace it; a new stat ANDs in
  return prev.some(f => f.stat === stat)
    ? prev.map(f => (f.stat === stat ? { stat, value } : f))
    : [...prev, { stat, value }]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Details = Record<string, any> | null | undefined

function matchesOne(details: Details, f: HighlightFilter, zone?: string): boolean {
  if (f.stat === 'zone') return zone === f.value
  if (f.stat === 'name') {
    const name = (details?.display_name || details?.name || '') as string
    return name.toLowerCase().includes(String(f.value).toLowerCase())
  }
  if (f.stat === 'text') return cardTextMatches(details?.text as string | undefined, String(f.value))
  if (f.stat === 'keyword') {
    const kws: string[] = ((details?.keywords as string[] | undefined) || []).map(k => k.toLowerCase())
    const needle = String(f.value).toLowerCase()
    return kws.some(k => k === needle || k.startsWith(needle + ' '))
  }
  if (f.stat === 'type') {
    const types: string[] = ((details?.types as string[] | undefined) || []).map(t => t.toLowerCase())
    const tv = String(f.value)
    if (tv === 'attack') return types.includes('attack') && types.includes('action')
    if (tv === 'non-attack') return types.includes('action') && !types.includes('attack')
    if (tv === 'defense-reaction') return types.includes('defense reaction')
    if (tv === 'attack-reaction') return types.includes('attack reaction')
    return types.includes(tv)
  }
  if (f.stat === 'arcane') {
    const text = (details?.text ?? '') as string
    return [...text.matchAll(/(\d+)\s+arcane damage/gi)].some(m => parseInt(m[1]) === f.value)
  }
  let v = details?.[f.stat] as number | undefined
  if (v == null && f.stat === 'defense') v = 0
  if (v == null) return false
  const threshold = typeof f.value === 'string' && f.value.endsWith('+') ? parseInt(f.value) : null
  return threshold !== null ? v >= threshold : v === f.value
}

/** Does a card (its printing details, and zone for 'zone' filters) match the active filters? */
export function matchesHighlight(details: Details, filters: HighlightFilter[], zone?: string): boolean {
  if (filters.length === 0) return false
  const byStat = new Map<string, HighlightFilter[]>()
  for (const f of filters) byStat.set(f.stat, [...(byStat.get(f.stat) ?? []), f])
  return [...byStat.values()].every(group => group.some(f => matchesOne(details, f, zone)))
}
