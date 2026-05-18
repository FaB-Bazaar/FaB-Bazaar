import { describe, test, expect } from 'vitest';
import { sortPrintingsByLanguage, languageFlag } from './printing-language';

describe('sortPrintingsByLanguage', () => {
  test('puts English first, then French, then Japanese', () => {
    const input = [
      { printing_id: 'ja-1', language: 'ja' },
      { printing_id: 'fr-1', language: 'fr' },
      { printing_id: 'en-1', language: 'en' },
    ];
    const result = sortPrintingsByLanguage(input);
    expect(result.map((p) => p.printing_id)).toEqual(['en-1', 'fr-1', 'ja-1']);
  });

  test('groups remaining languages after the priority three', () => {
    // Priority order is en, fr, ja. Everything else (de, it, es) comes after,
    // grouped by language (within-group order preserved, no cross-group order
    // requirement beyond "after priorities").
    const input = [
      { printing_id: 'de-1', language: 'de' },
      { printing_id: 'fr-1', language: 'fr' },
      { printing_id: 'it-1', language: 'it' },
      { printing_id: 'en-1', language: 'en' },
      { printing_id: 'de-2', language: 'de' },
      { printing_id: 'ja-1', language: 'ja' },
      { printing_id: 'it-2', language: 'it' },
    ];
    const result = sortPrintingsByLanguage(input);
    const ids = result.map((p) => p.printing_id);

    expect(ids.slice(0, 3)).toEqual(['en-1', 'fr-1', 'ja-1']);

    // The remaining 4 are de+it. Each language group must be contiguous.
    const remaining = ids.slice(3);
    const remainingLangs = remaining.map((id) => id.split('-')[0]);
    const firstDeIdx = remainingLangs.indexOf('de');
    const lastDeIdx = remainingLangs.lastIndexOf('de');
    const firstItIdx = remainingLangs.indexOf('it');
    const lastItIdx = remainingLangs.lastIndexOf('it');

    // Contiguity check: no interleaving
    expect(lastDeIdx - firstDeIdx).toBe(1); // 2 de's, adjacent
    expect(lastItIdx - firstItIdx).toBe(1); // 2 it's, adjacent
  });

  test('preserves original order within a language group (stable sort)', () => {
    const input = [
      { printing_id: 'en-2', language: 'en' },
      { printing_id: 'en-1', language: 'en' },
      { printing_id: 'en-3', language: 'en' },
    ];
    const result = sortPrintingsByLanguage(input);
    expect(result.map((p) => p.printing_id)).toEqual(['en-2', 'en-1', 'en-3']);
  });

  test('treats missing/null language as English (so legacy data sorts first)', () => {
    const input = [
      { printing_id: 'fr-1', language: 'fr' },
      { printing_id: 'legacy', language: null as unknown as string },
    ];
    const result = sortPrintingsByLanguage(input);
    expect(result.map((p) => p.printing_id)).toEqual(['legacy', 'fr-1']);
  });

  test('returns a new array (does not mutate input)', () => {
    const input = [
      { printing_id: 'fr-1', language: 'fr' },
      { printing_id: 'en-1', language: 'en' },
    ];
    const originalOrder = input.map((p) => p.printing_id);
    sortPrintingsByLanguage(input);
    expect(input.map((p) => p.printing_id)).toEqual(originalOrder);
  });
});

describe('languageFlag', () => {
  test('returns expected emoji flags for the six supported languages', () => {
    expect(languageFlag('en')).toBe('🇬🇧');
    expect(languageFlag('fr')).toBe('🇫🇷');
    expect(languageFlag('de')).toBe('🇩🇪');
    expect(languageFlag('it')).toBe('🇮🇹');
    expect(languageFlag('es')).toBe('🇪🇸');
    expect(languageFlag('ja')).toBe('🇯🇵');
  });

  test('returns a fallback (globe) for unknown language codes', () => {
    expect(languageFlag('zz')).toBe('🌐');
    expect(languageFlag('')).toBe('🌐');
    expect(languageFlag(null as unknown as string)).toBe('🌐');
  });

  test('is case-insensitive', () => {
    expect(languageFlag('EN')).toBe('🇬🇧');
    expect(languageFlag('Fr')).toBe('🇫🇷');
  });
});
