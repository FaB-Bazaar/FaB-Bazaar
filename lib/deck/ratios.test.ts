import { describe, it, expect } from 'vitest'
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { countMeasure, measureLabel, ratioRow, sanitizeRatios, type DeckRatio } from './ratios'

const card = (qty: number, details: Record<string, unknown>): DeckPrintingDTO => ({ printingId: Math.random().toString(), quantity: qty, printingDetails: details })
const deck = {
  hero: [card(1, { text: 'discard', pitch: 1 })],
  benched: [card(3, { text: 'discard', pitch: 1 })],
  equipment: [card(1, { text: 'Gate', types: ['equipment'] })],
  maindeck: [
    card(3, { text: 'Discard a card.', types: ['generic', 'action', 'attack'], keywords: ['go again'], pitch: 1 }),
    card(2, { text: 'Create a Gate token.', types: ['shadow', 'defense reaction'], pitch: 3 }),
  ],
  inventory: [card(1, { text: 'draw', types: ['instant'], keywords_display: ['Go again'], pitch: 2 })],
} as unknown as DeckDTO

describe('countMeasure', () => {
  it('counts copies over main deck + equipment + inventory (not hero/bench)', () => {
    expect(countMeasure(deck, { kind: 'text', value: 'discard' })).toBe(3)
    expect(countMeasure(deck, { kind: 'text', value: 'gate' })).toBe(3)
    expect(countMeasure(deck, { kind: 'type', value: 'attack' })).toBe(3)
    expect(countMeasure(deck, { kind: 'type', value: 'defense-reaction' })).toBe(2)
    expect(countMeasure(deck, { kind: 'keyword', value: 'go again' })).toBe(4)
    expect(countMeasure(deck, { kind: 'pitch', value: '1' })).toBe(3)
    expect(countMeasure(deck, { kind: 'pitch', value: '3' })).toBe(2)
  })
})

describe('measureLabel', () => {
  it('names a measure for display', () => {
    expect(measureLabel({ kind: 'text', value: 'discard' })).toBe('"discard"')
    expect(measureLabel({ kind: 'type', value: 'defense-reaction' })).toBe('Defense reaction')
    expect(measureLabel({ kind: 'keyword', value: 'go again' })).toBe('Go again')
    expect(measureLabel({ kind: 'pitch', value: '2' })).toBe('Yellow')
  })
})

describe('ratioRow', () => {
  it('formats a two-sided ratio', () => {
    const r: DeckRatio = { id: 'r1', a: { kind: 'text', value: 'discard' }, b: { kind: 'text', value: 'gate' } }
    expect(ratioRow(r, deck)).toEqual({ label: '"discard" : "gate"', value: '3 : 3', note: '1 : 1' })
  })

  it('leaves out the reduced ratio when it would just repeat the counts', () => {
    const r: DeckRatio = { id: 'r3', a: { kind: 'keyword', value: 'go again' }, b: { kind: 'type', value: 'defense-reaction' } }
    expect(ratioRow(r, deck)).toEqual({ label: 'Go again : Defense reaction', value: '4 : 2', note: '2 : 1' })
    const same: DeckRatio = { id: 'r4', a: { kind: 'type', value: 'attack' }, b: { kind: 'pitch', value: '2' } }
    expect(ratioRow(same, deck)).toEqual({ label: 'Attack : Yellow', value: '3 : 1', note: '' })
  })

  it('formats a single measure as a share of the counted cards', () => {
    const r: DeckRatio = { id: 'r2', a: { kind: 'keyword', value: 'go again' } }
    expect(ratioRow(r, deck)).toEqual({ label: 'Go again', value: '4 of 7', note: '57%' })
  })
})

describe('sanitizeRatios', () => {
  it('keeps well-formed ratios and trims values', () => {
    expect(sanitizeRatios([{ id: 'a', a: { kind: 'text', value: '  discard ' }, b: { kind: 'pitch', value: '3' } }]))
      .toEqual([{ id: 'a', a: { kind: 'text', value: 'discard' }, b: { kind: 'pitch', value: '3' } }])
  })

  it('drops junk: unknown kinds, empty values, bad pitch, non-objects, and caps list + value length', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, a: { kind: 'text', value: 'x'.repeat(100) } }))
    const out = sanitizeRatios([
      null, 'nope', { id: 'b', a: { kind: 'evil', value: 'x' } }, { id: 'c', a: { kind: 'text', value: '   ' } },
      { id: 'd', a: { kind: 'pitch', value: '7' } }, { a: { kind: 'text', value: 'no id' } }, ...many,
    ])
    expect(out).toHaveLength(20)
    expect(out![0].a.value).toHaveLength(60)
  })

  it('rejects a non-array', () => {
    expect(sanitizeRatios({ a: 1 })).toBeNull()
  })
})
