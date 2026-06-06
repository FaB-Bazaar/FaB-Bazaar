import { describe, it, expect } from 'vitest'
import { groupPrintingsToCardOptions, type RawSearchPrinting } from './card-search-utils'

const p = (over: Partial<RawSearchPrinting>): RawSearchPrinting => ({
  card_unique_id: 'card-a',
  name: 'command and conquer',
  pitch: 1,
  color: 'red',
  image_url: 'https://img/a.png',
  ...over,
})

describe('groupPrintingsToCardOptions', () => {
  it('collapses multiple printings of the same card_unique_id into one option', () => {
    const result = groupPrintingsToCardOptions([
      p({ card_unique_id: 'card-a', image_url: 'https://img/a1.png' }),
      p({ card_unique_id: 'card-a', image_url: 'https://img/a2.png' }),
      p({ card_unique_id: 'card-a', image_url: 'https://img/a3.png' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].cardUniqueId).toBe('card-a')
  })

  it('keeps distinct card_unique_ids (e.g. different pitches) as separate options', () => {
    const result = groupPrintingsToCardOptions([
      p({ card_unique_id: 'snatch-red', name: 'snatch', pitch: 1 }),
      p({ card_unique_id: 'snatch-yellow', name: 'snatch', pitch: 2 }),
    ])
    expect(result).toHaveLength(2)
    expect(result.map(r => r.cardUniqueId).sort()).toEqual(['snatch-red', 'snatch-yellow'])
  })

  it('picks an image_url from whichever printing has one', () => {
    const result = groupPrintingsToCardOptions([
      p({ card_unique_id: 'card-x', image_url: '' }),
      p({ card_unique_id: 'card-x', image_url: 'https://img/x.png' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].imageUrl).toBe('https://img/x.png')
  })

  it('prefers display_name over name when present', () => {
    const result = groupPrintingsToCardOptions([
      p({ card_unique_id: 'c', name: 'raw name', display_name: 'Pretty Name' }),
    ])
    expect(result[0].name).toBe('Pretty Name')
  })

  it('sorts by name then pitch', () => {
    const result = groupPrintingsToCardOptions([
      p({ card_unique_id: 'b2', name: 'bravo', pitch: 2 }),
      p({ card_unique_id: 'a1', name: 'aether spindle', pitch: 1 }),
      p({ card_unique_id: 'b1', name: 'bravo', pitch: 1 }),
    ])
    expect(result.map(r => r.cardUniqueId)).toEqual(['a1', 'b1', 'b2'])
  })

  it('ignores printings missing a card_unique_id', () => {
    const result = groupPrintingsToCardOptions([
      p({ card_unique_id: '' }),
      p({ card_unique_id: 'real' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].cardUniqueId).toBe('real')
  })

  it('returns an empty array for no input', () => {
    expect(groupPrintingsToCardOptions([])).toEqual([])
  })
})
