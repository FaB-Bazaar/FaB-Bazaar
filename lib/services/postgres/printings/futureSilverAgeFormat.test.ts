/**
 * Silver Age takes spoiler-season cards, like CC (owner call 2026-11-28): the
 * Silver Age pool = silver_age_legal PLUS every card printed in a set whose
 * release_date is today or later (category != 'excluded') that WOULD be Silver
 * Age legal — ever printed at common / rare / basic / token (TRP 7.4) and not
 * an adult hero — minus Silver Age bans. Talishar / Cintari validate at play
 * time. Young OBK heroes (release 2027-02-12) are the motivating case.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 * Fixtures use the `merchant` class, like futureCcFormat.test.ts, so sibling
 * files counting generic / class pools aren't disturbed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { cards, printings, sets, bannedCards } from '@/lib/postgres/schema';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const rand = crypto.randomUUID().slice(0, 6);
const futureSet = `zs${rand.slice(0, 3)}`;
const pastSet = `zq${rand.slice(0, 3)}`;
const excludedFutureSet = `zy${rand.slice(0, 3)}`;

const ids = {
  youngHero: `test-fsa-young-${rand}`,
  youngMajesticHero: `test-fsa-young-m-${rand}`,
  adultHero: `test-fsa-adult-${rand}`,
  commonAction: `test-fsa-common-${rand}`,
  majesticAction: `test-fsa-majestic-${rand}`,
  pastAction: `test-fsa-past-${rand}`,
  excludedAction: `test-fsa-excl-${rand}`,
  banned: `test-fsa-banned-${rand}`,
};
const allCardIds = Object.values(ids);
const printingIds: string[] = [];

const isoDaysFromNow = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  const base = 900_000 + Math.floor(Math.random() * 1_000_000);
  await db.insert(sets).values([
    { code: futureSet, displayCode: futureSet.toUpperCase(), name: `Test SA Future ${rand}`, releaseDate: isoDaysFromNow(30), releaseOrder: base, displayOrder: base, category: 'standard' },
    { code: pastSet, displayCode: pastSet.toUpperCase(), name: `Test SA Past ${rand}`, releaseDate: isoDaysFromNow(-30), releaseOrder: base + 1, displayOrder: base + 1, category: 'standard' },
    { code: excludedFutureSet, displayCode: excludedFutureSet.toUpperCase(), name: `Test SA Excluded ${rand}`, releaseDate: isoDaysFromNow(30), releaseOrder: base + 2, displayOrder: base + 2, category: 'excluded' },
  ]);
  const card = (cardUniqueId: string, types: string[], extra: Record<string, unknown> = {}) => ({
    cardUniqueId, name: cardUniqueId, displayName: cardUniqueId, types, classes: ['merchant'], ...extra,
  });
  await db.insert(cards).values([
    card(ids.youngHero, ['merchant', 'hero', 'young'], { isHero: true }),
    card(ids.youngMajesticHero, ['merchant', 'hero', 'young'], { isHero: true }),
    card(ids.adultHero, ['merchant', 'hero'], { isHero: true }),
    card(ids.commonAction, ['merchant', 'action']),
    card(ids.majesticAction, ['merchant', 'action']),
    card(ids.pastAction, ['merchant', 'action']),
    card(ids.excludedAction, ['merchant', 'action']),
    card(ids.banned, ['merchant', 'action']),
  ]);
  const mk = async (cardUniqueId: string, set: string, n: number, rarity: string) => {
    const id = nanoid(21);
    await db.insert(printings).values({ printingId: id, cardUniqueId, set, collectorNumber: `${set.toUpperCase()}${String(n).padStart(3, '0')}`, edition: 'n', foiling: 's', rarity, isFrontFace: true });
    printingIds.push(id);
  };
  await mk(ids.youngHero, futureSet, 1, 'b');
  await mk(ids.youngMajesticHero, futureSet, 2, 'm');
  await mk(ids.adultHero, futureSet, 3, 'b');
  await mk(ids.commonAction, futureSet, 4, 'c');
  await mk(ids.majesticAction, futureSet, 5, 'm');
  await mk(ids.pastAction, pastSet, 1, 'c');
  await mk(ids.excludedAction, excludedFutureSet, 1, 'c');
  await mk(ids.banned, futureSet, 6, 'r');
  await db.insert(bannedCards).values({
    id: nanoid(21), cardUniqueId: ids.banned, format: 'silver_age', restrictionType: 'banned', statusActive: true, updatedAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(bannedCards).where(inArray(bannedCards.cardUniqueId, allCardIds));
  if (printingIds.length) await db.delete(printings).where(inArray(printings.printingId, printingIds));
  await db.delete(cards).where(inArray(cards.cardUniqueId, allCardIds));
  await db.delete(sets).where(inArray(sets.code, [futureSet, pastSet, excludedFutureSet]));
});

async function silverAgeIds(extra: Record<string, unknown> = {}) {
  const result = await service.searchPrintings({ cardUniqueIds: allCardIds, format: 'silver_age', ...extra } as any, { limit: 50 } as any);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return new Set(result.data.printings.map((p: any) => p.card_unique_id));
}

describe('searchPrintings format=silver_age takes spoiler-season cards', () => {
  it('includes an unreleased young hero and an unreleased common card', async () => {
    const got = await silverAgeIds();
    expect(got.has(ids.youngHero)).toBe(true);
    expect(got.has(ids.commonAction)).toBe(true);
  });

  it('keeps the Silver Age rarity rule: an unreleased majestic card or young hero stays out', async () => {
    const got = await silverAgeIds();
    expect(got.has(ids.majesticAction)).toBe(false);
    expect(got.has(ids.youngMajesticHero)).toBe(false);
  });

  it('never takes an adult hero', async () => {
    expect((await silverAgeIds()).has(ids.adultHero)).toBe(false);
  });

  it('still excludes released-but-not-legal cards, excluded-category sets and the Silver Age banlist', async () => {
    const got = await silverAgeIds();
    expect(got.has(ids.pastAction)).toBe(false);
    expect(got.has(ids.excludedAction)).toBe(false);
    expect(got.has(ids.banned)).toBe(false);
    expect((await silverAgeIds({ includeBanned: true })).has(ids.banned)).toBe(true);
  });

  it('projects future_silver_age on search rows (grouped path too)', async () => {
    const result = await service.searchPrintings(
      { cardUniqueIds: [ids.commonAction, ids.majesticAction, ids.pastAction] } as any,
      { groupByCard: true, limit: 10 } as any,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = new Map(result.data.printings.map((p: any) => [p.card_unique_id, p]));
    expect(byId.get(ids.commonAction)?.future_silver_age).toBe(true);
    expect(byId.get(ids.majesticAction)?.future_silver_age).toBe(false);
    expect(byId.get(ids.pastAction)?.future_silver_age).toBe(false);
  });
});

describe('listHeroCards legalIn=silver_age', () => {
  it('lists an unreleased young hero, marked futureSilverAgeLegal', async () => {
    const result = await service.listHeroCards({ legalIn: 'silver_age' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const row = result.data.find(h => h.cardUniqueId === ids.youngHero);
    expect(row?.silverAgeLegal).toBe(false);
    expect(row?.futureSilverAgeLegal).toBe(true);
  });

  it('leaves out a majestic young hero and an adult hero', async () => {
    const result = await service.listHeroCards({ legalIn: 'silver_age' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.some(h => h.cardUniqueId === ids.youngMajesticHero)).toBe(false);
    expect(result.data.some(h => h.cardUniqueId === ids.adultHero)).toBe(false);
  });
});
