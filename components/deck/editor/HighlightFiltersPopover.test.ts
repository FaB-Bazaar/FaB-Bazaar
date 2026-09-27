import { describe, it, expect } from 'vitest'
import { chipLabel } from './HighlightFiltersPopover'

describe('chipLabel', () => {
  it('labels the stat filters', () => {
    expect(chipLabel({ stat: 'cost', value: 2 })).toBe('Cost 2')
    expect(chipLabel({ stat: 'pitch', value: 1 })).toBe('Pitch 1')
  })

  // These stats come from the Cmd+K chords / deck v2 panel; they used to render "undefined discard".
  it('labels text, type, keyword, name and arcane highlights', () => {
    expect(chipLabel({ stat: 'text', value: 'discard' })).toBe('"discard" in text')
    expect(chipLabel({ stat: 'type', value: 'defense-reaction' })).toBe('Type defense-reaction')
    expect(chipLabel({ stat: 'keyword', value: 'go again' })).toBe('Keyword go again')
    expect(chipLabel({ stat: 'name', value: 'bone' })).toBe('Name "bone"')
    expect(chipLabel({ stat: 'arcane', value: 2 })).toBe('Arcane 2')
  })
})
