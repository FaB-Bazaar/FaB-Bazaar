/**
 * Unit tests for buildOwnershipMap — the pure transform from the
 * inventory-comparison DTO to the per-printing ownership map PlaymatView's
 * zone overlay renders (Owned / Partial / Missing badges).
 *
 * Regression pinned here: the previous inline version read
 * `data.comparison.*` (a key the route never returned) with Mongo-era field
 * names (`ownedQuantity`/`neededQuantity`), so the overlay never populated.
 * This maps the REAL InventoryComparisonDTO shape: owned[]/partial[]/missing[]
 * with `owned`/`needed`/`binderNames`.
 */

import { describe, it, expect } from 'vitest';
import { buildOwnershipMap, buildCardOwnershipMap } from './ownership-map';
import type { InventoryComparisonDTO } from '@/lib/services/contracts/IDeckService';

const dto: InventoryComparisonDTO = {
  owned: [
    {
      printingId: 'p-owned',
      cardName: 'Snatch',
      needed: 3,
      owned: 3,
      conditions: ['NM'],
      binderNames: ['Main Binder'],
    },
  ],
  partial: [
    {
      printingId: 'p-partial',
      cardName: 'Sink Below',
      needed: 3,
      owned: 1,
      shortage: 2,
    },
  ],
  missing: [
    {
      printingId: 'p-missing',
      cardName: 'Fyendal Spring Tunic',
      needed: 1,
    },
  ],
  summary: {
    totalNeeded: 7,
    totalOwned: 4,
    totalMissing: 3,
    completionPercentage: 57,
    estimatedMissingValue: 12.5,
  },
};

describe('buildOwnershipMap', () => {
  it('maps owned entries with full quantity and binder names', () => {
    const map = buildOwnershipMap(dto);
    expect(map.get('p-owned')).toEqual({
      owned: 3,
      needed: 3,
      binderNames: ['Main Binder'],
    });
  });

  it('maps partial entries with their real owned count', () => {
    const map = buildOwnershipMap(dto);
    expect(map.get('p-partial')).toEqual({
      owned: 1,
      needed: 3,
      binderNames: [],
    });
  });

  it('maps missing entries as owned 0', () => {
    const map = buildOwnershipMap(dto);
    expect(map.get('p-missing')).toEqual({
      owned: 0,
      needed: 1,
      binderNames: [],
    });
  });

  it('covers every printing across all three buckets', () => {
    const map = buildOwnershipMap(dto);
    expect(map.size).toBe(3);
  });

  it('returns an empty map for an empty comparison', () => {
    const empty: InventoryComparisonDTO = {
      owned: [],
      partial: [],
      missing: [],
      summary: { totalNeeded: 0, totalOwned: 0, totalMissing: 0, completionPercentage: 100, estimatedMissingValue: 0 },
    };
    expect(buildOwnershipMap(empty).size).toBe(0);
  });
});

/**
 * buildCardOwnershipMap consumes a matchBy:'card' comparison (one row per
 * card_unique_id, `owned` = copies across ALL printings) and keys the map
 * by card_unique_id — Collector Mode's "regardless of printing" hiding.
 */
describe('buildCardOwnershipMap', () => {
  const cardDto: InventoryComparisonDTO = {
    owned: [
      { printingId: 'p-rep-1', cardUniqueId: 'cu-1', cardName: 'Snatch', needed: 3, owned: 3, conditions: [], binderNames: ['Main'] },
    ],
    partial: [
      { printingId: 'p-rep-2', cardUniqueId: 'cu-2', cardName: 'Sink Below', needed: 3, owned: 1, shortage: 2 },
    ],
    missing: [
      { printingId: 'p-rep-3', cardUniqueId: 'cu-3', cardName: 'Fyendal Spring Tunic', needed: 1 },
    ],
    summary: { totalNeeded: 7, totalOwned: 4, totalMissing: 3, completionPercentage: 57, estimatedMissingValue: 12.5 },
  };

  it('keys entries by card_unique_id across all three buckets', () => {
    const map = buildCardOwnershipMap(cardDto);
    expect(map.get('cu-1')).toMatchObject({ owned: 3, needed: 3 });
    expect(map.get('cu-2')).toMatchObject({ owned: 1, needed: 3 });
    expect(map.get('cu-3')).toMatchObject({ owned: 0, needed: 1 });
    expect(map.size).toBe(3);
  });

  it('skips rows without a cardUniqueId (older server payloads)', () => {
    const legacy: InventoryComparisonDTO = {
      owned: [{ printingId: 'p-old', cardName: 'Old Row', needed: 1, owned: 1, conditions: [], binderNames: [] }],
      partial: [],
      missing: [],
      summary: { totalNeeded: 1, totalOwned: 1, totalMissing: 0, completionPercentage: 100, estimatedMissingValue: 0 },
    };
    expect(buildCardOwnershipMap(legacy).size).toBe(0);
  });
});
