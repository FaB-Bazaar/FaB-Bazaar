import { describe, it, expect } from 'vitest'
import { deriveFormatFromHero, heroRestrictions, restrictionChipLabel, formatShortLabel } from './hero-format-utils'
import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService'
import type { RestrictionType } from '@/lib/services/contracts/IBannedCardsService'

const hero = (over: Partial<HeroLegalityRow>): HeroLegalityRow => ({
  cardUniqueId: 'h1',
  name: 'ira, crimson haze',
  displayName: 'Ira, Crimson Haze',
  imageUrl: null,
  types: ['ninja', 'hero', 'young'],
  klass: 'ninja',
  ccLegal: false,
  futureCcLegal: false,
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

const byFormat = (entries: Record<string, [string, RestrictionType][]>) =>
  Object.fromEntries(Object.entries(entries).map(([f, pairs]) => [f, new Map(pairs)]))

describe('heroRestrictions', () => {
  it('reports a Living Legend graduate with its status', () => {
    const bravo = hero({
      cardUniqueId: 'bravo-id', ccLegal: false, silverAgeLegal: false, blitzLegal: false,
      commonerLegal: false, llLegal: true, types: ['guardian', 'hero'],
    })
    const r = byFormat({ 'Classic Constructed': [['bravo-id', 'living_legend']] })
    expect(heroRestrictions(bravo, r)).toEqual([{ format: 'Classic Constructed', status: 'living_legend' }])
  })

  it('reports a benched Silver Age hero with its status', () => {
    const ira = hero({ cardUniqueId: 'ira-id' })
    const r = byFormat({ 'Silver Age': [['ira-id', 'benched']] })
    expect(heroRestrictions(ira, r)).toEqual([{ format: 'Silver Age', status: 'benched' }])
  })

  it('returns every restricting format, primary formats first', () => {
    const h = hero({ cardUniqueId: 'multi' })
    const r = byFormat({
      'Living Legend': [['multi', 'banned']],
      'Silver Age': [['multi', 'benched']],
      'Classic Constructed': [['multi', 'banned']],
    })
    expect(heroRestrictions(h, r).map(x => x.format)).toEqual(['Classic Constructed', 'Silver Age', 'Living Legend'])
  })

  it('returns an empty array when the hero is unrestricted', () => {
    const h = hero({ cardUniqueId: 'clean-id' })
    expect(heroRestrictions(h, {})).toEqual([])
    expect(heroRestrictions(h, byFormat({ 'Silver Age': [['other', 'banned']] }))).toEqual([])
  })
})

describe('restrictionChipLabel', () => {
  it('labels a Living Legend graduate without a format suffix', () => {
    expect(restrictionChipLabel({ format: 'Classic Constructed', status: 'living_legend' })).toBe('Living Legend')
  })
  it('labels a benched hero with the short format', () => {
    expect(restrictionChipLabel({ format: 'Silver Age', status: 'benched' })).toBe('Benched · Sage')
  })
  it('labels a banned hero with the short format', () => {
    expect(restrictionChipLabel({ format: 'Classic Constructed', status: 'banned' })).toBe('Banned · CC')
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

describe('deriveFormatFromHero — Future Classic Constructed', () => {
  const noFlags = { ccLegal: false, blitzLegal: false, silverAgeLegal: false, commonerLegal: false, llLegal: false }

  it('derives Future CC for an adult hero whose only legality is a future-dated set', () => {
    const h = hero({ ...noFlags, types: ['necromancer', 'hero', 'adult'], futureCcLegal: true })
    expect(deriveFormatFromHero(h)).toBe('Future Classic Constructed')
  })

  it('still prefers CC when the hero is CC-legal today', () => {
    const h = hero({ ...noFlags, ccLegal: true, types: ['necromancer', 'hero', 'adult'], futureCcLegal: true })
    expect(deriveFormatFromHero(h)).toBe('Classic Constructed')
  })

  it('does not derive Future CC for a young hero (adult-only format)', () => {
    const h = hero({ ...noFlags, types: ['necromancer', 'hero', 'young'], futureCcLegal: true })
    expect(deriveFormatFromHero(h)).toBe('Classic Constructed')
  })

  it('has a short chip label', () => {
    expect(formatShortLabel('Future Classic Constructed')).toBe('Future CC')
  })
})
