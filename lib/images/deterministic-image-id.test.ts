/**
 * Unit tests: deterministicImageId() — LSS-style, human-readable Cloudflare
 * image ids derived purely from a printing's own attributes, so every
 * environment (local, prod) computes the identical id for the same physical
 * printing and shares one uploaded image.
 *
 * Shape: [LANG_]COLLECTOR[-RF|-CF|-GF][-EA][-1E|-UL|-AL][-ARTVARS...][_BACK]
 * mirroring LSS's own face ids (ROS076-RF, JA_ROS076, FR_IAR106-CF_BACK).
 *
 * Returns null when no safe id can be derived (missing collector, unsafe
 * characters) — callers keep the printing_id-keyed image in that case.
 * Global uniqueness is NOT this function's job; the migration script audits
 * collisions across the DB and falls back for colliding groups.
 */
import { describe, it, expect } from 'vitest';
import { deterministicImageId } from './deterministic-image-id';

const base = {
  language: 'en',
  collector_number: 'IAR106',
  foiling: 's',
  edition: 'n',
  is_extended_art: false,
  is_front_face: true,
  art_variations: null as string[] | null,
};

describe('deterministicImageId', () => {
  it('plain English standard printing is just the collector number', () => {
    expect(deterministicImageId(base)).toBe('IAR106');
  });

  it('foilings map to LSS suffixes (s bare, r/c/g suffixed)', () => {
    expect(deterministicImageId({ ...base, foiling: 'r' })).toBe('IAR106-RF');
    expect(deterministicImageId({ ...base, foiling: 'c' })).toBe('IAR106-CF');
    expect(deterministicImageId({ ...base, foiling: 'g' })).toBe('IAR106-GF');
  });

  it('non-English languages get an uppercase prefix', () => {
    expect(deterministicImageId({ ...base, language: 'ja' })).toBe('JA_IAR106');
    expect(deterministicImageId({ ...base, language: 'fr', foiling: 'c' })).toBe('FR_IAR106-CF');
  });

  it('extended art appends -EA', () => {
    expect(deterministicImageId({ ...base, is_extended_art: true })).toBe('IAR106-EA');
  });

  it('non-default editions are distinguished', () => {
    expect(deterministicImageId({ ...base, edition: 'f' })).toBe('IAR106-1E');
    expect(deterministicImageId({ ...base, edition: 'u' })).toBe('IAR106-UL');
    expect(deterministicImageId({ ...base, edition: 'a' })).toBe('IAR106-AL');
  });

  it('back faces end in _BACK', () => {
    expect(deterministicImageId({ ...base, is_front_face: false })).toBe('IAR106_BACK');
    expect(
      deterministicImageId({ ...base, language: 'ja', foiling: 'c', is_front_face: false }),
    ).toBe('JA_IAR106-CF_BACK');
  });

  it('art variations are appended, empty entries filtered', () => {
    expect(deterministicImageId({ ...base, art_variations: ['AA'] })).toBe('IAR106-AA');
    expect(deterministicImageId({ ...base, art_variations: ['AA', 'FA'] })).toBe('IAR106-AA-FA');
    expect(deterministicImageId({ ...base, art_variations: [''] })).toBe('IAR106');
    expect(deterministicImageId({ ...base, art_variations: [] })).toBe('IAR106');
  });

  it('everything composes in a fixed order', () => {
    expect(
      deterministicImageId({
        language: 'fr',
        collector_number: 'MPG112',
        foiling: 'c',
        edition: 'n',
        is_extended_art: true,
        is_front_face: false,
        art_variations: ['AA'],
      }),
    ).toBe('FR_MPG112-CF-EA-AA_BACK');
  });

  it('returns null when no safe id can be derived', () => {
    expect(deterministicImageId({ ...base, collector_number: '' })).toBeNull();
    expect(deterministicImageId({ ...base, collector_number: null as unknown as string })).toBeNull();
    expect(deterministicImageId({ ...base, collector_number: 'BAD CN/1' })).toBeNull();
    expect(deterministicImageId({ ...base, art_variations: ['weird art!'] })).toBeNull();
  });

  it('normalizes case: language upper, collector kept as stored', () => {
    expect(deterministicImageId({ ...base, language: 'JA' })).toBe('JA_IAR106');
  });
});
