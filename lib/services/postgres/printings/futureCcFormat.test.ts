/**
 * Integration tests for the Future Classic Constructed card pool
 * (search format 'future_cc'): every CC-legal card PLUS every card that has a
 * printing in a set whose release_date is after today (category != 'excluded'),
 * minus CC bans / suspensions.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 * Fixtures are inserted per file with random ids and removed in afterAll.
 * They use the `merchant` class on purpose: sibling files (classTalentUnion,
 * genericTalentless) assert live COUNTS of generic/warrior/talent cards and run
 * in parallel against the same DB, so a generic fixture appearing mid-run
 * breaks their arithmetic.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { cards, printings, sets, bannedCards } from '@/lib/postgres/schema';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const rand = crypto.randomUUID().slice(0, 6);
const futureSet = `zf${rand.slice(0, 3)}`;
const pastSet = `zp${rand.slice(0, 3)}`;
const excludedFutureSet = `zx${rand.slice(0, 3)}`;

const futureHeroId = `test-fcc-hero-${rand}`;
const futureYoungHeroId = `test-fcc-young-${rand}`;
const futureActionId = `test-fcc-action-${rand}`;
const pastActionId = `test-fcc-past-${rand}`;
const excludedActionId = `test-fcc-excl-${rand}`;
const bannedFutureId = `test-fcc-banned-${rand}`;
const allCardIds = [futureHeroId, futureYoungHeroId, futureActionId, pastActionId, excludedActionId, bannedFutureId];
const printingIds: string[] = [];

const isoDaysFromNow = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  const base = 700_000 + Math.floor(Math.random() * 1_000_000);
  await db.insert(sets).values([
    { code: futureSet, displayCode: futureSet.toUpperCase(), name: `Test Future ${rand}`, releaseDate: isoDaysFromNow(30), releaseOrder: base, displayOrder: base, category: 'standard' },
    { code: pastSet, displayCode: pastSet.toUpperCase(), name: `Test Past ${rand}`, releaseDate: isoDaysFromNow(-30), releaseOrder: base + 1, displayOrder: base + 1, category: 'standard' },
    { code: excludedFutureSet, displayCode: excludedFutureSet.toUpperCase(), name: `Test Excluded Future ${rand}`, releaseDate: isoDaysFromNow(30), releaseOrder: base + 2, displayOrder: base + 2, category: 'excluded' },
  ]);

  await db.insert(cards).values([
    { cardUniqueId: futureHeroId, name: `test fcc hero ${rand}`, displayName: `Test FCC Hero ${rand}`, isHero: true, types: ['hero', 'adult', 'merchant'], classes: ['merchant'], ccLegal: false },
    { cardUniqueId: futureYoungHeroId, name: `test fcc young ${rand}`, displayName: `Test FCC Young ${rand}`, isHero: true, types: ['hero', 'young', 'merchant'], classes: ['merchant'], ccLegal: false },
    { cardUniqueId: futureActionId, name: `test fcc action ${rand}`, displayName: `Test FCC Action ${rand}`, types: ['action'], classes: ['merchant'], ccLegal: false },
    { cardUniqueId: pastActionId, name: `test fcc past ${rand}`, displayName: `Test FCC Past ${rand}`, types: ['action'], classes: ['merchant'], ccLegal: false },
    { cardUniqueId: excludedActionId, name: `test fcc excl ${rand}`, displayName: `Test FCC Excl ${rand}`, types: ['action'], classes: ['merchant'], ccLegal: false },
    { cardUniqueId: bannedFutureId, name: `test fcc banned ${rand}`, displayName: `Test FCC Banned ${rand}`, types: ['action'], classes: ['merchant'], ccLegal: false },
  ]);

  const mk = async (cardUniqueId: string, set: string, collectorNumber: string) => {
    const id = nanoid(21);
    await db.insert(printings).values({ printingId: id, cardUniqueId, set, collectorNumber, edition: 'N', foiling: 'S', rarity: 'C', isFrontFace: true });
    printingIds.push(id);
    return id;
  };
  await mk(futureHeroId, futureSet, `${futureSet.toUpperCase()}001`);
  await mk(futureYoungHeroId, futureSet, `${futureSet.toUpperCase()}004`);
  await mk(futureActionId, futureSet, `${futureSet.toUpperCase()}002`);
  await mk(pastActionId, pastSet, `${pastSet.toUpperCase()}001`);
  await mk(excludedActionId, excludedFutureSet, `${excludedFutureSet.toUpperCase()}001`);
  await mk(bannedFutureId, futureSet, `${futureSet.toUpperCase()}003`);

  await db.insert(bannedCards).values({
    id: nanoid(21), cardUniqueId: bannedFutureId, format: 'classic_constructed', restrictionType: 'banned', statusActive: true, updatedAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.cardUniqueId, allCardIds));
  if (printingIds.length) await db.delete(printings).where(inArray(printings.printingId, printingIds));
  await db.delete(cards).where(inArray(cards.cardUniqueId, allCardIds));
  await db.delete(sets).where(inArray(sets.code, [futureSet, pastSet, excludedFutureSet]));
});

async function futureCcIds(extra: Record<string, unknown> = {}) {
  const result = await service.searchPrintings({ cardUniqueIds: allCardIds, format: 'future_cc', ...extra } as any, { limit: 50 } as any);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return new Set(result.data.printings.map((p: any) => p.card_unique_id));
}

describe('searchPrintings format=future_cc', () => {
  it('includes a not-yet-CC-legal card printed in a future-dated set', async () => {
    const ids = await futureCcIds();
    expect(ids.has(futureActionId)).toBe(true);
    expect(ids.has(futureHeroId)).toBe(true);
  });

  it('excludes a not-CC-legal card whose only printing is in an already-released set', async () => {
    const ids = await futureCcIds();
    expect(ids.has(pastActionId)).toBe(false);
  });

  it('ignores future sets in the excluded category (demo decks, tokens)', async () => {
    const ids = await futureCcIds();
    expect(ids.has(excludedActionId)).toBe(false);
  });

  it('still applies the CC banlist', async () => {
    const ids = await futureCcIds();
    expect(ids.has(bannedFutureId)).toBe(false);
    const withBanned = await futureCcIds({ includeBanned: true });
    expect(withBanned.has(bannedFutureId)).toBe(true);
  });

  it('projects future_release on search rows', async () => {
    const result = await service.searchPrintings({ cardUniqueIds: [futureActionId, pastActionId] } as any, { limit: 10 } as any);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = new Map(result.data.printings.map((p: any) => [p.card_unique_id, p]));
    expect(byId.get(futureActionId)?.future_release).toBe(true);
    expect(byId.get(pastActionId)?.future_release).toBe(false);
  });
});

describe('searchPrintings grouped path (groupByCard wraps the select in a subquery)', () => {
  it('still projects future_release and honours format=future_cc', async () => {
    const result = await service.searchPrintings(
      { cardUniqueIds: allCardIds, format: 'future_cc' } as any,
      { groupByCard: true, limit: 50 } as any,
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    const ids = new Set(result.data.printings.map((p: any) => p.card_unique_id));
    expect(ids.has(futureActionId)).toBe(true);
    expect(ids.has(pastActionId)).toBe(false);
    const row: any = result.data.printings.find((p: any) => p.card_unique_id === futureActionId);
    expect(row?.future_release).toBe(true);
  });
});

describe('listHeroCards legalIn=future_cc', () => {
  it('lists a hero whose only printing is in a future-dated set', async () => {
    const result = await service.listHeroCards({ legalIn: 'future_cc' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const row = result.data.find(h => h.cardUniqueId === futureHeroId);
    expect(row).toBeDefined();
    expect(row?.ccLegal).toBe(false);
    expect(row?.futureCcLegal).toBe(true);
  });

  it('leaves young heroes out — Future CC is adult-only like CC', async () => {
    const result = await service.listHeroCards({ legalIn: 'future_cc' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.some(h => h.cardUniqueId === futureYoungHeroId)).toBe(false);
  });

  it('does not list that hero under plain cc', async () => {
    const result = await service.listHeroCards({ legalIn: 'cc' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.some(h => h.cardUniqueId === futureHeroId)).toBe(false);
  });
});
