/**
 * Integration tests for PostgresGameResultsService.getGameResultsForDeck.
 *
 * Verifies the slimmed-down summary shape introduced to speed up the deck
 * Results tab:
 *   - turn_log / opponent_turn_log / turn_results are no longer returned
 *   - each row carries an imageUrls map (cardId → image_url) covering every
 *     cardId in card_results + opponent_card_results, resolved server-side
 *     via cards.talishar_card_id → printings.image_url.
 *
 * Runs against the real local Postgres (requires POSTGRES_URL in .env.local).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, gameResults, cards, printings } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

interface Sample {
  talisharCardId: string;
  cardName: string;
  pitch: number | null;
  imageUrl: string;
}

let testUserId: string;
let deckId: string;
let publicId: string;
let sampleA: Sample;
let sampleB: Sample;

beforeAll(async () => {
  // Pick two real (talishar_card_id, image_url) pairs using the SAME ordering
  // the service uses (DISTINCT ON (talishar_card_id) ORDER BY set, edition),
  // so the expected image URL matches what enrichment will return.
  const { pool } = await import('@/lib/postgres/db');
  const { rows } = await pool.query<{ talishar_card_id: string; display_name: string; pitch: number | null; image_url: string }>(
    `SELECT DISTINCT ON (c.talishar_card_id)
            c.talishar_card_id, c.display_name, c.pitch, p.image_url
     FROM cards c
     INNER JOIN printings p ON p.card_unique_id = c.card_unique_id
     WHERE c.talishar_card_id IS NOT NULL AND p.image_url IS NOT NULL
     ORDER BY c.talishar_card_id, p.set ASC NULLS LAST, p.edition ASC NULLS LAST
     LIMIT 2`
  );
  if (rows.length < 2) throw new Error('Need at least 2 cards with talishar_card_id and image_url seeded.');
  sampleA = { talisharCardId: rows[0].talishar_card_id, cardName: rows[0].display_name, pitch: rows[0].pitch, imageUrl: rows[0].image_url };
  sampleB = { talisharCardId: rows[1].talishar_card_id, cardName: rows[1].display_name, pitch: rows[1].pitch, imageUrl: rows[1].image_url };
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  publicId = `t-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({ id: deckId, publicId, userId: testUserId, name: 'Test Deck' });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

function insertResult(overrides: Partial<typeof gameResults.$inferInsert>) {
  return db.insert(gameResults).values({
    id: crypto.randomUUID(),
    deckId,
    result: 'win',
    conceded: false,
    ...overrides,
  });
}

describe('PostgresGameResultsService.getGameResultsForDeck — summary shape', () => {
  it('omits turn_log, opponent_turn_log, and turn_results from each row', async () => {
    await insertResult({
      cardResults: [{ cardId: sampleA.talisharCardId, cardName: sampleA.cardName, played: 3, hits: 1, blocked: 0, pitched: 0 }],
      turnLog: [[1, sampleA.talisharCardId, 'M']],
      opponentTurnLog: [[1, sampleB.talisharCardId, 'M']],
      turnResults: { turn_1: { damageDealt: 4 } },
    });

    const res = await service.getGameResultsForDeck(deckId, {});

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.data).toHaveLength(1);
    const row = res.data.data[0] as unknown as Record<string, unknown>;
    expect(row).not.toHaveProperty('turnLog');
    expect(row).not.toHaveProperty('opponentTurnLog');
    expect(row).not.toHaveProperty('turnResults');
  });

  it('returns an imageUrls map keyed by cardId for every card in card_results', async () => {
    await insertResult({
      cardResults: [
        { cardId: sampleA.talisharCardId, cardName: sampleA.cardName, played: 2, hits: 0, blocked: 0, pitched: 0 },
        { cardId: sampleB.talisharCardId, cardName: sampleB.cardName, played: 1, hits: 0, blocked: 1, pitched: 0 },
      ],
    });

    const res = await service.getGameResultsForDeck(deckId, {});
    expect(res.success).toBe(true);
    if (!res.success) return;
    const row = res.data.data[0] as { imageUrls: Record<string, string> };
    expect(row.imageUrls).toBeDefined();
    expect(row.imageUrls[sampleA.talisharCardId]).toBe(sampleA.imageUrl);
    expect(row.imageUrls[sampleB.talisharCardId]).toBe(sampleB.imageUrl);
  });

  it('includes cardIds from opponent_card_results in the imageUrls map', async () => {
    await insertResult({
      cardResults: [],
      opponentCardResults: [
        { cardId: sampleA.talisharCardId, cardName: sampleA.cardName, played: 1, hits: 0, blocked: 0, pitched: 0 },
      ],
    });

    const res = await service.getGameResultsForDeck(deckId, {});
    expect(res.success).toBe(true);
    if (!res.success) return;
    const row = res.data.data[0] as { imageUrls: Record<string, string> };
    expect(row.imageUrls[sampleA.talisharCardId]).toBe(sampleA.imageUrl);
  });

  it('returns an empty imageUrls map when no cards are present', async () => {
    await insertResult({ cardResults: [], opponentCardResults: [] });

    const res = await service.getGameResultsForDeck(deckId, {});
    expect(res.success).toBe(true);
    if (!res.success) return;
    const row = res.data.data[0] as { imageUrls: Record<string, string> };
    expect(row.imageUrls).toEqual({});
  });

  it('returns the total row count separately from the paged data', async () => {
    await insertResult({ cardResults: [] });
    await insertResult({ cardResults: [] });
    await insertResult({ cardResults: [] });

    const res = await service.getGameResultsForDeck(deckId, { limit: 2, offset: 0 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.data).toHaveLength(2);
    expect(res.data.total).toBe(3);
  });
});
