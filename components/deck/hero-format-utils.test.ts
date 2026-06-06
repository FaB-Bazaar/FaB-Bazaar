import { describe, it, expect } from 'vitest'
import { deriveFormatFromHero, bannedFormatsForHero, formatShortLabel } from './hero-format-utils'
import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService'

const hero = (over: Partial<HeroLegalityRow>): HeroLegalityRow => ({
  cardUniqueId: 'h1',
  name: 'ira, crimson haze',
  displayName: 'Ira, Crimson Haze',
  imageUrl: null,
  types: ['ninja', 'hero', 'young'],
  klass: 'ninja',
  ccLegal: false,
  blitzLegal: true,
  silverAgeLegal: true,
  commonerLegal: true,
  llLegal: false,
  ...over,
})

describe('deriveFormatFromHero', () => {
  it('prefers CC for an adult CC-legal hero', () => {
    expect(deriveFormatFromHero(hero({ ccLegal: true }))).toBe('Classic Constructed')
  })

  it('derives Silver Age for a young hero (not CC-legal)', () => {
    expect(deriveFormatFromHero(hero({ ccLegal: false, silverAgeLegal: true }))).toBe('Silver Age')
  })

  it('falls back to Classic Constructed when no hero / no flags', () => {
    expect(deriveFormatFromHero(undefined)).toBe('Classic Constructed')
    expect(
      deriveFormatFromHero(
        hero({ ccLegal: false, silverAgeLegal: false, blitzLegal: false, commonerLegal: false, llLegal: false }),
      ),
    ).toBe('Classic Constructed')
  })
})

describe('bannedFormatsForHero', () => {
  it('lists the Silver Age ban for a young hero (true ban in its legal format)', () => {
    const ira = hero({ cardUniqueId: 'ira-id' })
    const banned = { 'Silver Age': new Set(['ira-id']) }
    expect(bannedFormatsForHero(ira, banned)).toEqual(['Silver Age'])
  })

  it('lists a CC ban even when CC is NOT the hero\'s derived format (LL hero)', () => {
    // Bravo, Star of the Show is ll-only but appears in the CC banned list.
    const bravo = hero({
      cardUniqueId: 'bravo-id',
      ccLegal: false, silverAgeLegal: false, blitzLegal: false, commonerLegal: false, llLegal: true,
      types: ['guardian', 'hero'],
    })
    const banned = { 'Classic Constructed': new Set(['bravo-id']) }
    expect(bannedFormatsForHero(bravo, banned)).toEqual(['Classic Constructed'])
  })

  it('returns every format a hero is banned in, primary formats first', () => {
    const h = hero({ cardUniqueId: 'multi' })
    const banned = {
      'Living Legend': new Set(['multi']),
      'Silver Age': new Set(['multi']),
      'Classic Constructed': new Set(['multi']),
    }
    // CC and Silver Age are the primary formats and sort first.
    expect(bannedFormatsForHero(h, banned)).toEqual(['Classic Constructed', 'Silver Age', 'Living Legend'])
  })

  it('returns an empty array when the hero is not banned anywhere', () => {
    const h = hero({ cardUniqueId: 'clean-id' })
    expect(bannedFormatsForHero(h, {})).toEqual([])
    expect(bannedFormatsForHero(h, { 'Silver Age': new Set(['other']) })).toEqual([])
  })
})

describe('formatShortLabel', () => {
  it('abbreviates the primary formats', () => {
    expect(formatShortLabel('Classic Constructed')).toBe('CC')
    expect(formatShortLabel('Silver Age')).toBe('Sage')
  })
  it('passes through other formats unchanged', () => {
    expect(formatShortLabel('Blitz')).toBe('Blitz')
    expect(formatShortLabel('Living Legend')).toBe('Living Legend')
  })
})
