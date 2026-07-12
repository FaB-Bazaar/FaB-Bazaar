/**
 * Integration test: arcane damage stat filters (arcane / arcaneMin / arcaneMax
 * / arcaneNot) — "what arcane spells deal 3 or more damage" must be a single
 * structured query, not a rules-text grep. Runs against local Postgres.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/postgres/db';
import { cards, printings } from '@/lib/postgres/schema';
import { inArray } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

// Unique name token so fixtures never collide with real cards or parallel runs.
const token = `zzarcanetest${crypto.randomUUID().slice(0, 8)}`;

type Fixture = { suffix: string; arcane: number | null; arcaneText?: string };
const FIXTURES: Fixture[] = [
  { suffix: 'drip', arcane: 1 },
  { suffix: 'bolt', arcane: 3 },
  { suffix: 'blast', arcane: 5 },
  { suffix: 'xspell', arcane: null, arcaneText: 'X' },
  { suffix: 'plain', arcane: null },
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

describe('PostgresPrintingsService — arcane filters', () => {
  // beforeAll, not beforeEach: fixtures are read-only for every test here, and
  // a single insert/delete window minimizes races against tests doing global
  // count comparisons (PostgresPrintingsService.case.test.ts).
  beforeAll(async () => {
    await db.insert(cards).values(
      FIXTURES.map((f, i) => ({
        cardUniqueId: cardIds[i],
        name: name(f),
        displayName: name(f),
        types: ['action'],
        // Mirror arcane onto the other stat columns so the *Not regression
        // tests (same SQL shape) reuse the same fixtures.
        power: f.arcane,
        cost: f.arcane,
        defense: f.arcane,
        arcane: f.arcane,
        arcaneText: f.arcaneText ?? (f.arcane === null ? '' : String(f.arcane)),
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

  it('arcaneMin returns only cards dealing at least that much arcane damage', async () => {
    expect(await search({ arcaneMin: 3 })).toEqual(
      [name(FIXTURES[1]), name(FIXTURES[2])].sort(),
    );
  });

  it('result rows carry the arcane value (so callers can display it)', async () => {
    const r = await service.searchPrintings(
      { name: name(FIXTURES[1]), exact: true },
      { groupByCard: true, limit: 1 },
    );
    if (!r.success) throw new Error(r.error);
    expect(r.data.printings[0]?.arcane).toBe(3);
  });

  it('arcaneMax bounds from above without matching NULL (no-arcane) cards', async () => {
    expect(await search({ arcaneMax: 3 })).toEqual(
      [name(FIXTURES[0]), name(FIXTURES[1])].sort(),
    );
  });

  it('arcane exact-matches a single value', async () => {
    expect(await search({ arcane: 3 })).toEqual([name(FIXTURES[1])]);
  });

  it('arcane: null matches only cards with no numeric arcane value', async () => {
    expect(await search({ arcane: null })).toEqual(
      [name(FIXTURES[3]), name(FIXTURES[4])].sort(),
    );
  });

  it('arcaneNot excludes listed values but keeps NULL cards', async () => {
    expect(await search({ arcaneNot: [1, 5] })).toEqual(
      [name(FIXTURES[1]), name(FIXTURES[3]), name(FIXTURES[4])].sort(),
    );
  });

  // Regression: the original powerNot/costNot/defenseNot SQL fragment passed a
  // JS array straight into `= ANY(...)` (drizzle renders a row constructor,
  // not an array) and left the OR unparenthesized — every query using them
  // failed outright. Same fixtures, same expectation as arcaneNot.
  const notExpected = () =>
    [name(FIXTURES[1]), name(FIXTURES[3]), name(FIXTURES[4])].sort();

  it('powerNot excludes listed values but keeps NULL cards', async () => {
    expect(await search({ powerNot: [1, 5] })).toEqual(notExpected());
  });

  it('costNot excludes listed values but keeps NULL cards', async () => {
    expect(await search({ costNot: [1, 5] })).toEqual(notExpected());
  });

  it('defenseNot excludes listed values but keeps NULL cards', async () => {
    expect(await search({ defenseNot: [1, 5] })).toEqual(notExpected());
  });
});
