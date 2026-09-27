import { describe, it, expect } from 'vitest'
import { matchupDisplayName } from './matchup-names'

describe('matchupDisplayName', () => {
  it('names the core plan and strategy plans', () => {
    expect(matchupDisplayName('core')).toBe('Core')
    expect(matchupDisplayName('fatigue')).toBe('Fatigue')
  })

  it('turns a Talishar hero id into the hero name (adult or young)', () => {
    expect(matchupDisplayName('briar_warden_of_thorns')).toBe('Briar, Warden Of Thorns')
    expect(matchupDisplayName('dorinthea_ironsong')).toBe('Dorinthea Ironsong')
  })

  it('falls back to the raw id', () => {
    expect(matchupDisplayName('not_a_hero_xyz')).toBe('not_a_hero_xyz')
  })
})
