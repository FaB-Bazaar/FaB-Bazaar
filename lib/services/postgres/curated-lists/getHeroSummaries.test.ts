/**
 * Integration tests for PostgresCuratedListService.getHeroSummaries.
 *
 * Verifies SQL-side aggregation: kit count, total tcgLow with cap-aware
 * summing. Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, curatedLists, curatedListCards, printings, cards } from '@/lib/postgres/schema';
import { PostgresCuratedListService } from './PostgresCuratedListService';

const service = new PostgresCuratedListService();

// Find three real printings with distinct type patterns so we exercise cap math.
interface PickedPrinting {
  printingId: string;
  tcgLow: number;
  types: string[];
}

let weaponPrinting: PickedPrinting;    // cap 2
let equipmentPrinting: PickedPrinting; // cap 1
let actionPrinting: PickedPrinting;    // cap 3 (default)

let testUserId: string;
const createdListIds: string[] = [];

async function findPrinting(predicate: (types: string[]) => boolean): Promise<PickedPrinting> {
  const rows = await db
    .select({
      printingId: printings.printingId,
      tcgLow: printings.tcgLow,
      types: cards.types,
    })
    .from(printings)
    .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
    .limit(2000);
  const match = rows.find(
    r => r.tcgLow !== null && Array.isArray(r.types) && predicate(r.types as string[])
  );
  if (!match) throw new Error('No matching printing found for predicate');
  return {
    printingId: match.printingId,
    tcgLow: match.tcgLow as number,
    types: match.types as string[],
  };
}

beforeAll(async () => {
  weaponPrinting = await findPrinting(t => t.includes('weapon'));
  equipmentPrinting = await findPrinting(t => t.includes('equipment') && !t.includes('evo'));
  actionPrinting = await findPrinting(
    t => !t.includes('weapon') && !t.includes('equipment')
  );
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  createdListIds.length = 0;
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  if (createdListIds.length > 0) {
    await db.delete(curatedLists).where(inArray(curatedLists.id, createdListIds));
  }
  await db.delete(users).where(eq(users.id, testUserId));
});

async function seedKit(opts: {
  heroName: string | null;
  format: string;
  printings: { printingId: string; count: number }[];
}): Promise<string> {
  const listId = crypto.randomUUID();
  createdListIds.push(listId);
  await db.insert(curatedLists).values({
    id: listId,
    name: `Test Kit ${listId}`,
    format: opts.format,
    heroName: opts.heroName,
    isPublished: true,
    createdBy: testUserId,
  });
  const rows = opts.printings.flatMap(p =>
    Array.from({ length: p.count }, (_, i) => ({
      id: crypto.randomUUID(),
      listId,
      printingId: p.printingId,
      sortOrder: i,
    }))
  );
  if (rows.length > 0) await db.insert(curatedListCards).values(rows);
  return listId;
}

describe('PostgresCuratedListService.getHeroSummaries', () => {
  it('returns hero summaries for the requested format only', async () => {
    const hero = `test-hero-${testUserId}`;
    await seedKit({
      heroName: hero,
      format: 'Classic Constructed',
      printings: [{ printingId: actionPrinting.printingId, count: 1 }],
    });
    await seedKit({
      heroName: hero,
      format: 'Blitz',
      printings: [{ printingId: actionPrinting.printingId, count: 1 }],
    });

    const result = await service.getHeroSummaries('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const row = result.data.find(r => r.heroName === hero);
    expect(row).toBeDefined();
    expect(row!.kitCount).toBe(1);
  });

  it('caps non-weapon/equipment cards at 3 copies per cardUniqueId', async () => {
    const hero = `test-hero-${testUserId}`;
    // 5 copies of an action card but cap is 3, so totalTcgLow = 3 * tcgLow.
    await seedKit({
      heroName: hero,
      format: 'Classic Constructed',
      printings: [{ printingId: actionPrinting.printingId, count: 5 }],
    });

    const result = await service.getHeroSummaries('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const row = result.data.find(r => r.heroName === hero);
    expect(row).toBeDefined();
    expect(row!.totalTcgLow).toBeCloseTo(actionPrinting.tcgLow * 3, 2);
  });

  it('caps weapons at 2 and equipment at 1', async () => {
    const hero = `test-hero-${testUserId}`;
    // 3 weapons (cap 2) + 2 equipments (cap 1) → 2*w + 1*e
    await seedKit({
      heroName: hero,
      format: 'Classic Constructed',
      printings: [
        { printingId: weaponPrinting.printingId, count: 3 },
        { printingId: equipmentPrinting.printingId, count: 2 },
      ],
    });

    const result = await service.getHeroSummaries('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const row = result.data.find(r => r.heroName === hero);
    expect(row).toBeDefined();
    const expected = weaponPrinting.tcgLow * 2 + equipmentPrinting.tcgLow * 1;
    expect(row!.totalTcgLow).toBeCloseTo(expected, 2);
  });

  it('aggregates across multiple kits for the same hero', async () => {
    const hero = `test-hero-${testUserId}`;
    await seedKit({
      heroName: hero,
      format: 'Classic Constructed',
      printings: [{ printingId: actionPrinting.printingId, count: 1 }],
    });
    await seedKit({
      heroName: hero,
      format: 'Classic Constructed',
      printings: [{ printingId: actionPrinting.printingId, count: 1 }],
    });

    const result = await service.getHeroSummaries('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const row = result.data.find(r => r.heroName === hero);
    expect(row).toBeDefined();
    expect(row!.kitCount).toBe(2);
    // Same cardUniqueId appears twice across the two kits → rawCount 2 capped to 2 (below cap of 3).
    expect(row!.totalTcgLow).toBeCloseTo(actionPrinting.tcgLow * 2, 2);
  });

  it('excludes unpublished lists', async () => {
    const hero = `test-hero-${testUserId}`;
    const listId = crypto.randomUUID();
    createdListIds.push(listId);
    await db.insert(curatedLists).values({
      id: listId,
      name: `Unpublished ${listId}`,
      format: 'Classic Constructed',
      heroName: hero,
      isPublished: false,
      createdBy: testUserId,
    });
    await db.insert(curatedListCards).values({
      id: crypto.randomUUID(),
      listId,
      printingId: actionPrinting.printingId,
      sortOrder: 0,
    });

    const result = await service.getHeroSummaries('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const row = result.data.find(r => r.heroName === hero);
    expect(row).toBeUndefined();
  });

  it('reports general (hero-less) kits via a null heroName entry', async () => {
    await seedKit({
      heroName: null,
      format: 'Classic Constructed',
      printings: [{ printingId: actionPrinting.printingId, count: 1 }],
    });

    const result = await service.getHeroSummaries('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const general = result.data.find(r => r.heroName === null);
    expect(general).toBeDefined();
    expect(general!.kitCount).toBeGreaterThanOrEqual(1);
  });
});
