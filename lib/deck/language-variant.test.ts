import { describe, it, expect } from 'vitest';
import { pickLanguageVariant } from './language-variant';

// Exact-variant-only language conversion: a deck card only swaps to the target
// language when the SAME set + edition + foiling exists in that language.
type P = { printing_id: string; set: string; edition: string; foiling: string; language: string };

const enRainbow: P = { printing_id: 'en1', set: 'omn', edition: 'n', foiling: 'r', language: 'en' };

describe('pickLanguageVariant', () => {
  it('returns the same set/edition/foiling printing in the target language', () => {
    const candidates: P[] = [
      { printing_id: 'fr1', set: 'omn', edition: 'n', foiling: 'r', language: 'fr' }, // exact
      { printing_id: 'fr2', set: 'omn', edition: 'n', foiling: 's', language: 'fr' }, // foiling differs
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')?.printing_id).toBe('fr1');
  });

  it('returns null when the foiling differs (no exact variant in target language)', () => {
    const candidates: P[] = [
      { printing_id: 'fr2', set: 'omn', edition: 'n', foiling: 's', language: 'fr' },
      { printing_id: 'de1', set: 'omn', edition: 'n', foiling: 'r', language: 'de' },
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')).toBeNull();
  });

  it('does not match a different set or edition', () => {
    const candidates: P[] = [
      { printing_id: 'fr3', set: 'evr', edition: 'n', foiling: 'r', language: 'fr' }, // set differs
      { printing_id: 'fr4', set: 'omn', edition: 'f', foiling: 'r', language: 'fr' }, // edition differs
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')).toBeNull();
  });

  it('returns null when the match is the current printing itself (already that language)', () => {
    const frCurrent: P = { printing_id: 'fr1', set: 'omn', edition: 'n', foiling: 'r', language: 'fr' };
    expect(pickLanguageVariant(frCurrent, [frCurrent], 'fr')).toBeNull();
  });
});
