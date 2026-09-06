/**
 * Integration tests for PostgresDeckService.swapPrinting with a copy count.
 *
 * The deck lightbox lets a user move 1, 2 or all N copies of a card to another
 * printing (e.g. 2 of 3 Sink Below → the History Pack reprint). swapPrinting
 * must move exactly `quantity` copies, defaulting to one (the historical
 * behaviour every existing caller relies on), and leave the rest untouched.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, and, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, cards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let deckPublicId: string;
let printingA: string; // Sink Below (red), earliest set
let printingB: string; // Sink Below (red), latest set — a different printing of the same card

beforeAll(async () => {
  const pick = async (order: 'asc' | 'desc') => {
    const rows = await db
      .select({ id: printings.printingId })
      .from(printings)
      .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(and(eq(cards.name, 'sink below'), eq(cards.pitch, 1), eq(printings.language, 'en')))
      .orderBy(order === 'asc' ? asc(printings.set) : desc(printings.set), asc(printings.printingId))
      .limit(1);
    if (!rows[0]) throw new Error('Need Sink Below (red) printings in DB');
    return rows[0].id;
  };
  printingA = await pick('asc');
  printingB = await pick('desc');
  expect(printingA).not.toBe(printingB);
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  deckPublicId = nanoid(21);
  await db.insert(decks).values({
    id: nanoid(21),
    publicId: deckPublicId,
    userId: testUserId,
    name: `Test swap ${deckPublicId}`,
    slug: `slug-${deckPublicId}`,
    format: 'Classic Constructed',
    heroName: 'kano, dracai of aether',
    visibility: 'private',
  });
  const added = await service.addPrintings(deckPublicId, testUserId, [{ printingId: printingA, quantity: 3, category: 'maindeck' }]);
  expect(added.success).toBe(true);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

const copiesOf = (deck: { maindeck: Array<{ printingId: string; quantity?: number }> }, id: string) =>
  deck.maindeck.filter((p) => p.printingId === id).reduce((n, p) => n + (p.quantity ?? 1), 0);

describe('PostgresDeckService.swapPrinting — quantity', () => {
  it('moves exactly the requested number of copies and leaves the rest', async () => {
    const res = await service.swapPrinting(deckPublicId, testUserId, printingA, printingB, 'maindeck', 2);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(copiesOf(res.data, printingA)).toBe(1);
    expect(copiesOf(res.data, printingB)).toBe(2);
  });

  it('defaults to one copy when quantity is omitted', async () => {
    const res = await service.swapPrinting(deckPublicId, testUserId, printingA, printingB, 'maindeck');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(copiesOf(res.data, printingA)).toBe(2);
    expect(copiesOf(res.data, printingB)).toBe(1);
  });

  it('moving all copies removes the old printing row entirely', async () => {
    const res = await service.swapPrinting(deckPublicId, testUserId, printingA, printingB, 'maindeck', 3);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(copiesOf(res.data, printingA)).toBe(0);
    expect(copiesOf(res.data, printingB)).toBe(3);
  });

  it('rejects a quantity above the copies present instead of over-adding', async () => {
    const res = await service.swapPrinting(deckPublicId, testUserId, printingA, printingB, 'maindeck', 4);
    expect(res.success).toBe(false);
    const deck = await service.findByPublicId(deckPublicId, testUserId);
    expect(deck.success && copiesOf(deck.data, printingA)).toBe(3);
    expect(deck.success && copiesOf(deck.data, printingB)).toBe(0);
  });
});
