/**
 * Strict name search must be accent-insensitive: a plain-ASCII query should
 * match cards whose names carry diacritics (e.g. "tropal" → "Riches of
 * Trōpal-Dhani"). Strict is the deck-editor default, so common accented cards
 * must be reachable without typing the diacritic.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService — strict name search is accent-insensitive', () => {
  it('matches an accented name from a plain-ASCII query (tropal → Trōpal-Dhani)', async () => {
    const res = await service.searchPrintings(
      { name: 'tropal' },
      { searchMode: 'strict', groupByCard: true, limit: 10 },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const hit = res.data.printings.some(p => p.name.toLowerCase().includes('riches of tr'));
    expect(hit).toBe(true);
  });

  it('still matches plain-ASCII names in strict mode (regression guard)', async () => {
    const res = await service.searchPrintings(
      { name: 'command and conquer' },
      { searchMode: 'strict', groupByCard: true, limit: 10 },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.some(p => p.name.toLowerCase().includes('command and conquer'))).toBe(true);
  });

  it('strict stays a phrase match — does not broaden "mangle" into "Entangle"', async () => {
    const res = await service.searchPrintings(
      { name: 'mangle' },
      { searchMode: 'strict', groupByCard: true, limit: 20 },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.every(p => !p.name.toLowerCase().includes('entangle'))).toBe(true);
  });
});
