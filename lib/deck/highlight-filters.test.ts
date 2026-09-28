import { describe, it, expect } from 'vitest'
import { applyHighlightEvent, matchesHighlight, type HighlightFilter } from './highlight-filters'

describe('applyHighlightEvent (the deck grid\'s filter-list rules)', () => {
  const f = (stat: string, value: number | string): HighlightFilter => ({ stat, value })

  it('adds a new stat, and pressing the same filter again removes it', () => {
    const one = applyHighlightEvent([], { stat: 'type', value: 'attack' })
    expect(one).toEqual([f('type', 'attack')])
    expect(applyHighlightEvent(one, { stat: 'type', value: 'attack' })).toEqual([])
  })

  it('a different value for the same stat replaces it; other stats AND in', () => {
    const s = applyHighlightEvent([f('type', 'attack'), f('cost', 0)], { stat: 'type', value: 'instant' })
    expect(s).toEqual([f('type', 'instant'), f('cost', 0)])
  })

  it('additive events (ranges) add values without replacing, and never duplicate', () => {
    let s = applyHighlightEvent([], { stat: 'power', value: 4, additive: true })
    s = applyHighlightEvent(s, { stat: 'power', value: 5, additive: true })
    s = applyHighlightEvent(s, { stat: 'power', value: 5, additive: true })
    expect(s).toEqual([f('power', 4), f('power', 5)])
  })

  it('multi-per-stat mode (hover mode) ORs a second value in', () => {
    expect(applyHighlightEvent([f('pitch', 1)], { stat: 'pitch', value: 3 }, { multiPerStat: true })).toEqual([f('pitch', 1), f('pitch', 3)])
  })
})

describe('matchesHighlight', () => {
  const attack = { types: ['Generic', 'Action', 'Attack'], keywords: ['go again'], text: 'Deal 2 arcane damage. **Discard** a card.', cost: 1, power: 4, defense: 3, pitch: 1, display_name: 'Test Strike' }
  const dr = { types: ['Generic', 'Defense Reaction'], keywords: [], text: '', cost: 0, defense: 4, pitch: 3, name: 'test block' }

  it('matches type buckets like the deck highlight (attack = action + attack)', () => {
    expect(matchesHighlight(attack, [{ stat: 'type', value: 'attack' }])).toBe(true)
    expect(matchesHighlight(dr, [{ stat: 'type', value: 'attack' }])).toBe(false)
    expect(matchesHighlight(dr, [{ stat: 'type', value: 'defense-reaction' }])).toBe(true)
  })

  it('keyword, text, name and arcane', () => {
    expect(matchesHighlight(attack, [{ stat: 'keyword', value: 'go again' }])).toBe(true)
    expect(matchesHighlight(attack, [{ stat: 'text', value: 'discard' }])).toBe(true)
    expect(matchesHighlight(attack, [{ stat: 'name', value: 'strike' }])).toBe(true)
    expect(matchesHighlight(attack, [{ stat: 'arcane', value: 2 }])).toBe(true)
    expect(matchesHighlight(dr, [{ stat: 'arcane', value: 2 }])).toBe(false)
  })

  it('numbers: exact, "N+" thresholds, and a missing defense counts as 0', () => {
    expect(matchesHighlight(attack, [{ stat: 'power', value: 4 }])).toBe(true)
    expect(matchesHighlight(attack, [{ stat: 'power', value: '3+' }])).toBe(true)
    expect(matchesHighlight({ types: ['action'] }, [{ stat: 'defense', value: 0 }])).toBe(true)
  })

  it('ORs values of one stat and ANDs different stats', () => {
    expect(matchesHighlight(dr, [{ stat: 'pitch', value: 1 }, { stat: 'pitch', value: 3 }])).toBe(true)
    expect(matchesHighlight(attack, [{ stat: 'pitch', value: 1 }, { stat: 'cost', value: 0 }])).toBe(false)
  })

  it('zone filters match the card\'s zone', () => {
    expect(matchesHighlight(attack, [{ stat: 'zone', value: 'inventory' }], 'inventory')).toBe(true)
    expect(matchesHighlight(attack, [{ stat: 'zone', value: 'inventory' }], 'maindeck')).toBe(false)
  })

  it('no filters → no match (nothing is highlighted)', () => {
    expect(matchesHighlight(attack, [])).toBe(false)
  })
})
