/**
 * Integration test: health stat filters (health / healthMin / healthMax /
 * healthNot) — "what allies have 4+ health" / "heroes with 20 life" must be a
 * single structured query, not a rules-text grep. Runs against local Postgres.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/postgres/db';
import { cards, printings } from '@/lib/postgres/schema';
import { inArray } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

// Unique name token so fixtures never collide with real cards or parallel runs.
const token = `zzhealthtest${crypto.randomUUID().slice(0, 8)}`;

type Fixture = { suffix: string; health: number | null; types: string[] };
const FIXTURES: Fixture[] = [
  { suffix: 'squire', health: 1, types: ['ally'] },
  { suffix: 'mate', health: 4, types: ['ally'] },
  { suffix: 'captain', health: 20, types: ['hero'] },
  { suffix: 'plain', health: null, types: ['action'] },
  { suffix: 'trick', health: null, types: ['action'] },
];

const cardIds = FIXTURES.map((f) => `${token}-card-${f.suffix}`);
const printingIds = FIXTURES.map((f) => `${token}-pr-${f.suffix}`);

const search = async (extra: Record<string, unknown>) => {
  const r = await service.searchPrintings(
    { name: token, exact: false, ...extra },
    { groupByCard: true, limit: 50 },
  );
  if (!r.success) throw new Error(r.error);
  return r.data.printings.map((p) => p.name).sort();
};

const name = (f: Fixture) => `${token} ${f.suffix}`;

describe('PostgresPrintingsService — health filters', () => {
  // beforeAll, not beforeEach: fixtures are read-only for every test here, and
  // a single insert/delete window minimizes races against tests doing global
  // count comparisons (PostgresPrintingsService.case.test.ts).
  beforeAll(async () => {
    await db.insert(cards).values(
      FIXTURES.map((f, i) => ({
        cardUniqueId: cardIds[i],
        name: name(f),
        displayName: name(f),
        types: f.types,
        health: f.health,
      })),
    );
    await db.insert(printings).values(
      FIXTURES.map((_, i) => ({
        printingId: printingIds[i],
        cardUniqueId: cardIds[i],
        set: 'wtr',
        edition: 'n',
        foiling: 's',
        rarity: 'c',
      })),
    );
  });

  afterAll(async () => {
    await db.delete(printings).where(inArray(printings.printingId, printingIds));
    await db.delete(cards).where(inArray(cards.cardUniqueId, cardIds));
  });

  it('healthMin returns only cards with at least that much health', async () => {
    expect(await search({ healthMin: 4 })).toEqual(
      [name(FIXTURES[1]), name(FIXTURES[2])].sort(),
    );
  });

  it('result rows carry the health value (so callers can display it)', async () => {
    const r = await service.searchPrintings(
      { name: name(FIXTURES[1]), exact: true },
      { groupByCard: true, limit: 1 },
    );
    if (!r.success) throw new Error(r.error);
    expect(r.data.printings[0]?.health).toBe(4);
  });

  it('healthMax bounds from above without matching NULL (no-health) cards', async () => {
    expect(await search({ healthMax: 4 })).toEqual(
      [name(FIXTURES[0]), name(FIXTURES[1])].sort(),
    );
  });

  it('health exact-matches a single value', async () => {
    expect(await search({ health: 4 })).toEqual([name(FIXTURES[1])]);
  });

  it('health: null matches only cards with no health value', async () => {
    expect(await search({ health: null })).toEqual(
      [name(FIXTURES[3]), name(FIXTURES[4])].sort(),
    );
  });

  it('healthNot excludes listed values but keeps NULL cards', async () => {
    expect(await search({ healthNot: [1, 20] })).toEqual(
      [name(FIXTURES[1]), name(FIXTURES[3]), name(FIXTURES[4])].sort(),
    );
  });

  it('composes with a type filter (allies with 4+ health)', async () => {
    expect(await search({ healthMin: 4, types: ['ally'] })).toEqual(
      [name(FIXTURES[1])],
    );
  });
});
