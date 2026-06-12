// lib/browse/utils/index.test.ts
//
// Pins selectDefaultPrinting: the default printing for an import must be an
// English printing whenever one exists — edition/foiling/price ranking only
// applies within that language preference.

import { describe, it, expect } from 'vitest';
import { selectDefaultPrinting } from './index';

describe('selectDefaultPrinting — language preference', () => {
  it('prefers an English printing over a non-English one with better edition/price', () => {
    // The French copy wins every existing tiebreaker (normal edition beats
    // first edition, higher tcg_low wins) — language must trump them all.
    const fr = { printing_id: 'fr1', edition: 'n', foiling: 's', tcg_low: 50, language: 'fr' };
    const en = { printing_id: 'en1', edition: 'f', foiling: 'r', tcg_low: 5, language: 'en' };

    const result = selectDefaultPrinting({ printings: [fr, en] });

    expect(result?.printing_id).toBe('en1');
  });

  it('falls back to a non-English printing when no English printing exists', () => {
    const fr = { printing_id: 'fr1', edition: 'n', foiling: 's', tcg_low: 2, language: 'fr' };

    const result = selectDefaultPrinting({ printings: [fr] });

    expect(result?.printing_id).toBe('fr1');
  });

  it('treats a missing language field as English', () => {
    const noLang = { printing_id: 'p1', edition: 'n', foiling: 's', tcg_low: 1 };
    const ja = { printing_id: 'ja1', edition: 'n', foiling: 's', tcg_low: 10, language: 'ja' };

    const result = selectDefaultPrinting({ printings: [ja, noLang] });

    expect(result?.printing_id).toBe('p1');
  });
});
