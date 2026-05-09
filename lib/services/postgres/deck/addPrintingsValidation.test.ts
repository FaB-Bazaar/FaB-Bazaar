/**
 * Integration tests for PostgresDeckService.addPrintings legality validation.
 *
 * Covers the per-card hero/format check that rejects illegal cards on add
 * with a clear reason in results[i].error, while letting legal cards in the
 * same call succeed alongside.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, cards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let aetherQuickeningPrintingId: string;
let aetherHailPrintingId: string;
let bruteAttackPrintingId: string;
let kanoHeroPrintingId: string;
let kanoAdultHeroPrintingId: string;
let crucibleWeaponPrintingId: string;

beforeAll(async () => {
  // Aether Quickening (red) — wizard, legal for Kano
  const aq = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'aether quickening'))
    .limit(1);
  if (!aq[0]) throw new Error('Need Aether Quickening in DB');
  aetherQuickeningPrintingId = aq[0].id;

  // Aether Hail — ice + wizard, NOT legal for Kano (no ice essence)
  const ah = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'aether hail'))
    .limit(1);
  if (!ah[0]) throw new Error('Need Aether Hail in DB');
  aetherHailPrintingId = ah[0].id;

  // A brute card — illegal for Kano (wrong class)
  const brute = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'beast within'))
    .limit(1);
  if (!brute[0]) throw new Error('Need Beast Within in DB');
  bruteAttackPrintingId = brute[0].id;

  // Young Kano hero printing
  const kano = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'kano'))
    .limit(1);
  if (!kano[0]) throw new Error('Need young Kano in DB');
  kanoHeroPrintingId = kano[0].id;

  // Adult Kano hero printing — wrong age for Silver Age decks
  const kanoAdult = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'kano, dracai of aether'))
    .limit(1);
  if (!kanoAdult[0]) throw new Error('Need adult Kano in DB');
  kanoAdultHeroPrintingId = kanoAdult[0].id;

  // Crucible of Aetherweave — wizard weapon, legal equipment for Kano
  const crucible = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'crucible of aetherweave'))
    .limit(1);
  if (!crucible[0]) throw new Error('Need Crucible of Aetherweave in DB');
  crucibleWeaponPrintingId = crucible[0].id;
});

let testDeckPublicId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  // Create a Silver Age Kano deck the same way create_deck would.
  const id = nanoid(21);
  testDeckPublicId = nanoid(21);
  await db.insert(decks).values({
    id,
    publicId: testDeckPublicId,
    userId: testUserId,
    name: `Test Kano SAGE ${testDeckPublicId}`,
    slug: `slug-${testDeckPublicId}`,
    format: 'Silver Age',
    heroName: 'kano',
    visibility: 'private',
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresDeckService.addPrintings — legality validation', () => {
  it('rejects an ice card (Aether Hail) for Kano with a clear per-card reason', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: aetherHailPrintingId, quantity: 2, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(false);
    expect(item.error).toBeDefined();
    expect(item.error!).toMatch(/ice/i);
    expect(result.data.summary.added).toBe(0);
    expect(result.data.summary.failed).toBe(1);
  });

  it('rejects a brute card (Beast Within) for Kano with a clear per-card reason', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: bruteAttackPrintingId, quantity: 1, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(false);
    expect(item.error!).toMatch(/brute/i);
  });

  it('accepts a wizard card (Aether Quickening) for Kano', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: aetherQuickeningPrintingId, quantity: 2, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(true);
    expect(result.data.summary.added).toBe(1);
  });

  it('rejects a 3rd copy of the same printing in Silver Age', async () => {
    // First add 2 — legal
    await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: aetherQuickeningPrintingId, quantity: 2, category: 'maindeck' },
    ]);
    // Now try to add a 3rd
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: aetherQuickeningPrintingId, quantity: 1, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(false);
    expect(item.error!).toMatch(/2 copies|max 2/i);
    expect(result.data.summary.added).toBe(0);
  });

  it('rejects an over-quantity add in a single call (3 copies in one shot)', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: aetherQuickeningPrintingId, quantity: 3, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(false);
    expect(item.error!).toMatch(/2 copies|max 2/i);
  });

  it('rejects an adult hero card added to a Silver Age deck (wrong age)', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: kanoAdultHeroPrintingId, quantity: 1, category: 'hero' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(false);
    expect(item.error!).toMatch(/silver age/i);
    expect(item.error!).toMatch(/young/i);
  });

  it('accepts the matching young hero card in a Silver Age deck', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: kanoHeroPrintingId, quantity: 1, category: 'hero' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(true);
  });

  it('mixed batch: legal card succeeds, illegal card fails — both reported in results[]', async () => {
    const result = await service.addPrintings(testDeckPublicId, testUserId, [
      { printingId: aetherQuickeningPrintingId, quantity: 2, category: 'maindeck' },
      { printingId: aetherHailPrintingId, quantity: 2, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.results).toHaveLength(2);
    const legal = result.data.results.find(r => r.printingId === aetherQuickeningPrintingId);
    const illegal = result.data.results.find(r => r.printingId === aetherHailPrintingId);
    expect(legal?.success).toBe(true);
    expect(illegal?.success).toBe(false);
    expect(illegal?.error!).toMatch(/ice/i);
    expect(result.data.summary.added).toBe(1);
    expect(result.data.summary.failed).toBe(1);
  });

});
