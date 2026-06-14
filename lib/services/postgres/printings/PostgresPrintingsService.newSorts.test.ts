/**
 * Integration tests for the new sort options on card search:
 *   color (pitch order), foiling (canonical), edition (rank + set release order),
 *   set (release order, not alphabetical), collector_number, defense.
 *
 * Property-based assertions (monotonic rank sequences) so they survive catalog
 * changes. Runs against local Postgres.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

// asc: red→yellow→blue→non-pitch ; desc: blue→yellow→red→non-pitch (empties always last)
const COLOR_RANK_ASC: Record<string, number> = { red: 1, yellow: 2, blue: 3, '': 4 };
const COLOR_RANK_DESC: Record<string, number> = { blue: 1, yellow: 2, red: 3, '': 4 };
const EDITION_RANK: Record<string, number> = { a: 1, f: 2, u: 3, n: 4 };
// canonical foiling order (mirrors canonicalPrintingOrder): non-foil → rainbow → cold → gold
const FOILING_RANK: Record<string, number> = { s: 0, n: 0, r: 1, c: 2, g: 3 };

const nonDecreasing = (arr: number[]) => arr.every((v, i) => i === 0 || arr[i - 1] <= v);

describe('PostgresPrintingsService — new sort options (flat)', () => {
  it('color asc orders red → yellow → blue → non-pitch', async () => {
    const res = await service.searchPrintings(
      { classes: ['runeblade'] },
      { limit: 2000, searchMode: 'strict', sortBy: 'color', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const ranks = res.data.printings.map((p) => COLOR_RANK_ASC[p.color ?? ''] ?? 4);
    expect(ranks.length).toBeGreaterThan(0);
    expect(new Set(res.data.printings.map((p) => p.color)).size).toBeGreaterThan(1); // meaningful
    expect(nonDecreasing(ranks)).toBe(true);
  });

  it('color desc orders blue → yellow → red, with non-pitch still last', async () => {
    const res = await service.searchPrintings(
      { classes: ['runeblade'] },
      { limit: 2000, searchMode: 'strict', sortBy: 'color', sortOrder: 'desc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const ranks = res.data.printings.map((p) => COLOR_RANK_DESC[p.color ?? ''] ?? 4);
    expect(nonDecreasing(ranks)).toBe(true);
  });

  it('edition asc orders Alpha → First → Unlimited → Normal', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr', 'arc', 'dyn'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'edition', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const ranks = res.data.printings.map((p) => EDITION_RANK[p.edition ?? ''] ?? 5);
    expect(ranks.length).toBeGreaterThan(0);
    expect(nonDecreasing(ranks)).toBe(true);
  });

  it('edition sort breaks ties by set release order (WTR before ARC within Unlimited)', async () => {
    // WTR and ARC both have Unlimited ('u') printings; WTR released earlier, so
    // within the Unlimited block WTR must precede ARC.
    const res = await service.searchPrintings(
      { sets: ['wtr', 'arc'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'edition', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const unlimited = res.data.printings.filter((p) => p.edition === 'u');
    const lastWtr = unlimited.map((p) => p.set).lastIndexOf('wtr');
    const firstArc = unlimited.map((p) => p.set).indexOf('arc');
    expect(lastWtr).toBeGreaterThanOrEqual(0);
    expect(firstArc).toBeGreaterThanOrEqual(0);
    expect(lastWtr).toBeLessThan(firstArc); // all WTR unlimited before any ARC unlimited
  });

  it('set asc uses release order (WTR before DYN), not alphabetical', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr', 'dyn'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'set', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const setSeq = res.data.printings.map((p) => p.set);
    const lastWtr = setSeq.lastIndexOf('wtr');
    const firstDyn = setSeq.indexOf('dyn');
    expect(lastWtr).toBeGreaterThanOrEqual(0);
    expect(firstDyn).toBeGreaterThanOrEqual(0);
    expect(lastWtr).toBeLessThan(firstDyn); // WTR (older) precedes DYN (newer)
  });

  it('set sort tiebreaks by collector number within a set', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'set', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const nums = res.data.printings.map((p) => p.collector_number).filter(Boolean) as string[];
    // Single set → release order is constant, so collector number fully orders the page.
    expect(nums).toEqual([...nums].sort((a, b) => a.localeCompare(b)));
  });

  it('foiling asc orders non-foil → rainbow → cold → gold', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'foiling', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const ranks = res.data.printings.map((p) => FOILING_RANK[p.foiling ?? ''] ?? 4);
    expect(new Set(res.data.printings.map((p) => p.foiling)).size).toBeGreaterThan(1);
    expect(nonDecreasing(ranks)).toBe(true);
  });

  it('collector_number asc is in natural numeric order (WTR010 before WTR011)', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'collector_number', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const nums = res.data.printings.map((p) => p.collector_number).filter(Boolean) as string[];
    const sorted = [...nums].sort((a, b) => a.localeCompare(b));
    expect(nums).toEqual(sorted);
  });

  it('defense asc lists ascending defense with NULLs last', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'defense', sortOrder: 'asc' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const def = res.data.printings.map((p) => p.defense);
    const firstNull = def.findIndex((d) => d == null);
    if (firstNull >= 0) {
      expect(def.slice(firstNull).every((d) => d == null)).toBe(true); // no value after a null
    }
    const vals = def.filter((d): d is number => d != null);
    expect(nonDecreasing(vals)).toBe(true);
  });
});

describe('PostgresPrintingsService — new sort options (grouped)', () => {
  it('color asc orders red → yellow → blue → non-pitch', async () => {
    const res = await service.searchPrintings(
      { classes: ['runeblade'] },
      { limit: 2000, searchMode: 'strict', sortBy: 'color', sortOrder: 'asc', groupByCard: true },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const ranks = res.data.printings.map((p) => COLOR_RANK_ASC[p.color ?? ''] ?? 4);
    expect(ranks.length).toBeGreaterThan(0);
    expect(new Set(res.data.printings.map((p) => p.color)).size).toBeGreaterThan(1);
    expect(nonDecreasing(ranks)).toBe(true);
  });

  it('set asc uses release order (WTR before DYN)', async () => {
    const res = await service.searchPrintings(
      { sets: ['wtr', 'dyn'] },
      { limit: 5000, searchMode: 'strict', sortBy: 'set', sortOrder: 'asc', groupByCard: true },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const setSeq = res.data.printings.map((p) => p.set);
    const lastWtr = setSeq.lastIndexOf('wtr');
    const firstDyn = setSeq.indexOf('dyn');
    expect(lastWtr).toBeGreaterThanOrEqual(0);
    expect(firstDyn).toBeGreaterThanOrEqual(0);
    expect(lastWtr).toBeLessThan(firstDyn);
  });

  it('set sort orders same-set, same-name cards by collector number (Sink Below pitches)', async () => {
    // Sink Below has red/yellow/blue pitch variants (WTR215/216/217), all same
    // set + same name — collector number must order them, not arbitrary.
    const res = await service.searchPrintings(
      { name: 'sink below' },
      { limit: 50, searchMode: 'strict', sortBy: 'set', sortOrder: 'asc', groupByCard: true },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const nums = res.data.printings.map((p) => p.collector_number).filter(Boolean) as string[];
    expect(nums.length).toBeGreaterThanOrEqual(3);
    expect(nums).toEqual([...nums].sort((a, b) => a.localeCompare(b)));
  });
});
