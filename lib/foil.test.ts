// lib/foil.ts — the foil "policy" contract shared by FoilCardImage (CSS)
// and HoloCard3D (WebGL). These tests pin the behavior both renderers rely on.
import { describe, it, expect } from 'vitest'
import {
  getFoilType,
  getInsetFromArtStyle,
  resolveFoilInset,
  artStylesFromPrinting,
  foilInsetFromValues,
} from './foil'

describe('getFoilType', () => {
  it('maps rainbow and cold foiling codes case-insensitively', () => {
    expect(getFoilType('R')).toBe('rainbow')
    expect(getFoilType('r')).toBe('rainbow')
    expect(getFoilType('C')).toBe('cold')
    expect(getFoilType('c')).toBe('cold')
  })
  it('maps everything else (standard, gold, undefined) to none', () => {
    expect(getFoilType('S')).toBe('none')
    expect(getFoilType('s')).toBe('none')
    expect(getFoilType('G')).toBe('none')
    expect(getFoilType(undefined)).toBe('none')
    expect(getFoilType('')).toBe('none')
  })
})

describe('getInsetFromArtStyle', () => {
  it('returns the standard-frame inset when no art styles given', () => {
    expect(getInsetFromArtStyle(undefined)).toEqual({ top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%' })
    expect(getInsetFromArtStyle([])).toEqual({ top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%' })
  })
  it('matches the most specific combination first (EA+AA+AB before EA+AA)', () => {
    expect(getInsetFromArtStyle(['extended-art', 'alternate-art', 'alternate-border'])).toEqual({ top: 0, right: 0, bottom: 30, left: 0, round: '0%' })
    expect(getInsetFromArtStyle(['extended-art', 'alternate-art'])).toEqual({ top: 0, right: 0, bottom: 26, left: 0, round: '0%' })
  })
  it('handles single-style variants', () => {
    expect(getInsetFromArtStyle(['full-art'])).toEqual({ top: 1, right: 2, bottom: 20, left: 2, round: '8px' })
    expect(getInsetFromArtStyle(['alternate-border'])).toEqual({ top: 1, right: 4, bottom: 20, left: 4, round: '12px' })
    expect(getInsetFromArtStyle(['alternate-art'])).toEqual({ top: 1, right: 4, bottom: 23, left: 4, round: '10px' })
    expect(getInsetFromArtStyle(['extended-art'])).toEqual({ top: 1, right: 0, bottom: 18, left: 0, round: '0%' })
  })
})

describe('resolveFoilInset', () => {
  it('prefers DB values and fills nulls per-field from the artStyle fallback', () => {
    const resolved = resolveFoilInset({ top: 5, right: null, bottom: 39.5, left: null, round: null }, ['full-art'])
    expect(resolved).toEqual({ top: 5, right: 2, bottom: 39.5, left: 2, round: '8px' })
  })
  it('falls back entirely to artStyle defaults when no DB inset exists', () => {
    expect(resolveFoilInset(null, undefined)).toEqual(getInsetFromArtStyle(undefined))
    expect(resolveFoilInset(undefined, ['extended-art'])).toEqual(getInsetFromArtStyle(['extended-art']))
  })
})

describe('artStylesFromPrinting', () => {
  it('derives all four styles from art variation codes + extended art flag', () => {
    expect(artStylesFromPrinting(['FA'], false)).toEqual(['full-art'])
    expect(artStylesFromPrinting(['AA'], false)).toEqual(['alternate-art'])
    // AB implies alternate-art AND alternate-border
    expect(artStylesFromPrinting(['AB'], false)).toEqual(['alternate-art', 'alternate-border'])
    expect(artStylesFromPrinting([], true)).toEqual(['extended-art'])
    expect(artStylesFromPrinting(['AA'], true)).toEqual(['alternate-art', 'extended-art'])
  })
  it('handles missing inputs', () => {
    expect(artStylesFromPrinting(undefined, undefined)).toEqual([])
    expect(artStylesFromPrinting(null, false)).toEqual([])
  })
})

describe('foilInsetFromValues', () => {
  it('builds a FoilInset when the bottom value exists (the presence sentinel)', () => {
    expect(foilInsetFromValues(1, 2, 39.5, 4, '0%')).toEqual({ top: 1, right: 2, bottom: 39.5, left: 4, round: '0%' })
    expect(foilInsetFromValues(null, null, 39.5, null, null)).toEqual({ top: null, right: null, bottom: 39.5, left: null, round: null })
  })
  it('returns null when bottom is missing — matches the existing call-site convention', () => {
    expect(foilInsetFromValues(1, 2, null, 4, '0%')).toBeNull()
    expect(foilInsetFromValues(undefined, undefined, undefined, undefined, undefined)).toBeNull()
  })
})
