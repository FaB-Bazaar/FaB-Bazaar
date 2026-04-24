/**
 * Integration tests for PostgresDeckService.createDeck with copyFromDeckId.
 *
 * Covers the fix that carries deck metadata (where matchups live) to the
 * copied deck. Before the fix, the copy flow inserted only cards and basic
 * fields; matchups were silently dropped.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let sourcePrintingId: string;

// A realistic matchups payload matching the production JSONB shape:
// metadata = { matchups: [{ heroId, preferredTurnOrder, notes, sideboard: { in, out } }, ...] }
const matchupsFixture = [
  {
    heroId: 'briar_warden_of_thorns',
    preferredTurnOrder: 'Second',
    notes: 'Block early, watch for Embodiment of Earth',
    sideboard: {
      in: ['unmovable_red', 'unmovable_red'],
      out: ['pummel_red', 'pummel_yellow'],
    },
  },
  {
    heroId: 'core',
    preferredTurnOrder: 'NoPreference',
    notes: 'Baseline list',
    sideboard: { in: [], out: [] },
  },
];

beforeAll(async () => {
  const rows = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .limit(1);
  if (rows.length < 1) throw new Error('Need at least 1 printing in DB');
  sourcePrintingId = rows[0].printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

async function insertSourceDeck(params: {
  name: string;
  metadata: unknown | null;
}): Promise<{ id: string; publicId: string }> {
  const id = nanoid(21);
  const publicId = nanoid(21);
  await db.insert(decks).values({
    id,
    publicId,
    userId: testUserId,
    name: params.name,
    slug: `slug-${publicId}`,
    format: 'Classic Constructed',
    heroName: 'Test Hero',
    visibility: 'unlisted',
    metadata: params.metadata as any,
  });
  // One card so the copy has something to iterate over
  await db.insert(deckCards).values({
    id: nanoid(21),
    deckId: id,
    printingId: sourcePrintingId,
    quantity: 1,
    category: 'maindeck',
    addedAt: new Date(),
  });
  return { id, publicId };
}

describe('PostgresDeckService.createDeck — copyFromDeckId carries matchups', () => {
  it('copies metadata.matchups from source to new deck', async () => {
    const source = await insertSourceDeck({
      name: `Source ${Date.now()}`,
      metadata: { matchups: matchupsFixture },
    });

    const result = await service.createDeck(testUserId, {
      name: `Copy ${Date.now()}`,
      format: 'Classic Constructed',
      copyFromDeckId: source.publicId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const copied = await db
      .select({ metadata: decks.metadata })
      .from(decks)
      .where(eq(decks.publicId, result.data.publicId))
      .limit(1);

    expect(copied[0].metadata).toEqual({ matchups: matchupsFixture });
  });

  it('leaves metadata null on copy when source had no metadata', async () => {
    const source = await insertSourceDeck({
      name: `Source no-meta ${Date.now()}`,
      metadata: null,
    });

    const result = await service.createDeck(testUserId, {
      name: `Copy no-meta ${Date.now()}`,
      format: 'Classic Constructed',
      copyFromDeckId: source.publicId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const copied = await db
      .select({ metadata: decks.metadata })
      .from(decks)
      .where(eq(decks.publicId, result.data.publicId))
      .limit(1);

    expect(copied[0].metadata).toBeNull();
  });

  it('produces independent metadata copies (source and copy are decoupled)', async () => {
    const source = await insertSourceDeck({
      name: `Source indep ${Date.now()}`,
      metadata: { matchups: matchupsFixture },
    });

    const result = await service.createDeck(testUserId, {
      name: `Copy indep ${Date.now()}`,
      format: 'Classic Constructed',
      copyFromDeckId: source.publicId,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Mutate the copy's matchups; source must remain untouched
    await db
      .update(decks)
      .set({ metadata: { matchups: [] } })
      .where(eq(decks.publicId, result.data.publicId));

    const sourceAfter = await db
      .select({ metadata: decks.metadata })
      .from(decks)
      .where(eq(decks.id, source.id))
      .limit(1);

    expect(sourceAfter[0].metadata).toEqual({ matchups: matchupsFixture });
  });
});
