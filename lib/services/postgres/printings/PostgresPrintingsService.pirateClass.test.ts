/**
 * Integration tests: pirate is a CLASS, not a talent.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Official LSS classification: Pirate is a class (Puffin = "Pirate
 * Mechanologist", Marlynn = "Pirate Ranger"). Migration 0065 moved it from
 * cards.talents to cards.classes once, but the nightly pipeline (003 → 005)
 * kept filing it under talents and silently reverted the move — so the /opt
 * Class → Pirate filter (`classes && ARRAY['pirate']`) matched zero cards on
 * prod. Migration 0102 re-applies the reclassification in the exact shape the
 * (fixed) transformer now emits, and these tests pin that data shape through
 * the search service.
 *
 * Fixture: Conqueror of the High Seas (SEA130, "Pirate Action - Attack").
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();
const CARD = 'Conqueror of the High Seas';

async function names(filters: Parameters<typeof service.searchPrintings>[0]) {
  const r = await service.searchPrintings(filters, { limit: 50, groupByCard: true });
  expect(r.success).toBe(true);
  if (!r.success) return [];
  return r.data.printings.map(p => p.name);
}

describe('PostgresPrintingsService — pirate is a class', () => {
  it('classes: ["pirate"] finds a pirate-only card by name', async () => {
    expect(await names({ name: 'conqueror', exact: false, classes: ['pirate'] })).toContain(CARD);
  });

  it('talents: ["pirate"] no longer matches it', async () => {
    expect(await names({ name: 'conqueror', exact: false, talents: ['pirate'] })).not.toContain(CARD);
  });

  it('a pirate-only card is not generic', async () => {
    // Pirate cards are class-restricted (only pirate heroes may play them), so
    // they must not surface under the generic class filter.
    expect(await names({ name: 'conqueror', exact: false, classes: ['generic'] })).not.toContain(CARD);
    expect(await names({ name: 'conqueror', exact: false, isGeneric: true })).not.toContain(CARD);
  });

  it('hasPirate flag still tracks pirate cards after the move', async () => {
    expect(await names({ name: 'conqueror', exact: false, hasPirate: true })).toContain(CARD);
  });

  it('a pirate hero still gets pirate cards in its legal pool', async () => {
    // Marlynn, Treasure Hunter — Pirate Ranger.
    expect(await names({ name: 'conqueror', exact: false, heroLegal: 'Marlynn, Treasure Hunter' })).toContain(CARD);
  });

  it('a non-pirate hero does not get pirate cards', async () => {
    expect(await names({ name: 'conqueror', exact: false, heroLegal: 'Kayo, Berserker Runt' })).not.toContain(CARD);
  });
});
