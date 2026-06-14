import { describe, it, expect } from 'vitest';
import { pickLanguageVariant } from './language-variant';

// Convert to the CLOSEST printing of the same card in the target language:
// exact (set+edition+foiling) wins, else same foiling in another set, else any.
// Foiling is preserved over set/edition. Cards with no target-language printing
// at all are left as-is (null).
type P = { printing_id: string; set: string; edition: string; foiling: string; language: string };

const enRainbow: P = { printing_id: 'en1', set: 'omn', edition: 'n', foiling: 'r', language: 'en' };

describe('pickLanguageVariant', () => {
  it('prefers the exact same set/edition/foiling printing', () => {
    const candidates: P[] = [
      { printing_id: 'fr_other', set: 'evr', edition: 'n', foiling: 'r', language: 'fr' }, // same foiling, other set
      { printing_id: 'fr_exact', set: 'omn', edition: 'n', foiling: 'r', language: 'fr' }, // exact
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')?.printing_id).toBe('fr_exact');
  });

  it('falls back to the same foiling in another set when there is no exact match', () => {
    const candidates: P[] = [
      { printing_id: 'fr_set2', set: 'evr', edition: 'n', foiling: 'r', language: 'fr' }, // same foiling (rainbow)
      { printing_id: 'fr_std', set: 'omn', edition: 'n', foiling: 's', language: 'fr' }, // different foiling
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')?.printing_id).toBe('fr_set2');
  });

  it('falls back to any target-language printing when foiling cannot be matched', () => {
    const candidates: P[] = [
      { printing_id: 'fr_std', set: 'evr', edition: 'n', foiling: 's', language: 'fr' }, // only standard fr exists
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')?.printing_id).toBe('fr_std');
  });

  it('returns null when the card has no printing in the target language', () => {
    const candidates: P[] = [
      { printing_id: 'de1', set: 'omn', edition: 'n', foiling: 'r', language: 'de' },
    ];
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')).toBeNull();
  });

  it('returns null when the only match is the current printing itself', () => {
    const frCurrent: P = { printing_id: 'fr1', set: 'omn', edition: 'n', foiling: 'r', language: 'fr' };
    expect(pickLanguageVariant(frCurrent, [frCurrent], 'fr')).toBeNull();
  });

  it('leaves an already-target-language card alone, even if other variants exist', () => {
    // A card already in French must NOT be swapped to a different French printing.
    const frCurrent: P = { printing_id: 'fr1', set: 'omn', edition: 'n', foiling: 'r', language: 'fr' };
    const otherFr: P[] = [{ printing_id: 'fr2', set: 'evr', edition: 'n', foiling: 'r', language: 'fr' }];
    expect(pickLanguageVariant(frCurrent, otherFr, 'fr')).toBeNull();
  });

  it('is deterministic across equally-scored candidates (stable by set then id)', () => {
    const candidates: P[] = [
      { printing_id: 'fr_b', set: 'zzz', edition: 'n', foiling: 'r', language: 'fr' },
      { printing_id: 'fr_a', set: 'aaa', edition: 'n', foiling: 'r', language: 'fr' },
    ];
    // both are same-foiling, non-exact; pick the set-ascending one
    expect(pickLanguageVariant(enRainbow, candidates, 'fr')?.printing_id).toBe('fr_a');
  });
});
