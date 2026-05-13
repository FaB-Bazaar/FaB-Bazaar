/**
 * Integration tests for PostgresGameResultsService.getGameResult — the
 * single-row detail endpoint used to lazy-load turn-log data when a game
 * row is expanded.
 *
 * Returns the full row (including turn_log / opponent_turn_log / turn_results)
 * with an imageUrls map covering every cardId referenced anywhere — card
 * results AND turn logs (after Talishar state-suffix normalization, e.g.
 * "crown_of_providence_equip" → "crown_of_providence").
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/lib/postgres/db';
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
let otherDeckId: string;
let otherPublicId: string;
let sampleA: Sample;
let sampleB: Sample;
let equipSample: { talisharCardId: string; cardName: string; imageUrl: string };

beforeAll(async () => {
  const { rows } = await pool.query<{ talishar_card_id: string; display_name: string; pitch: number | null; image_url: string }>(
    `SELECT DISTINCT ON (c.talishar_card_id)
            c.talishar_card_id, c.display_name, c.pitch, p.image_url
     FROM cards c
     INNER JOIN printings p ON p.card_unique_id = c.card_unique_id
     WHERE c.talishar_card_id IS NOT NULL AND p.image_url IS NOT NULL
     ORDER BY c.talishar_card_id, p.set ASC NULLS LAST, p.edition ASC NULLS LAST
     LIMIT 2`
  );
  if (rows.length < 2) throw new Error('Need 2 cards seeded.');
  sampleA = { talisharCardId: rows[0].talishar_card_id, cardName: rows[0].display_name, pitch: rows[0].pitch, imageUrl: rows[0].image_url };
  sampleB = { talisharCardId: rows[1].talishar_card_id, cardName: rows[1].display_name, pitch: rows[1].pitch, imageUrl: rows[1].image_url };

  // Pick an equipment-style card (no pitch) so we can exercise the
  // turn-log "_equip" suffix normalization.
  const { rows: equipRows } = await pool.query<{ talishar_card_id: string; display_name: string; image_url: string }>(
    `SELECT DISTINCT ON (c.talishar_card_id)
            c.talishar_card_id, c.display_name, p.image_url
     FROM cards c
     INNER JOIN printings p ON p.card_unique_id = c.card_unique_id
     WHERE c.talishar_card_id IS NOT NULL
       AND c.pitch IS NULL
       AND p.image_url IS NOT NULL
     ORDER BY c.talishar_card_id, p.set ASC NULLS LAST, p.edition ASC NULLS LAST
     LIMIT 1`
  );
  if (equipRows.length < 1) throw new Error('Need a pitchless card seeded.');
  equipSample = { talisharCardId: equipRows[0].talishar_card_id, cardName: equipRows[0].display_name, imageUrl: equipRows[0].image_url };
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  publicId = `t-${crypto.randomUUID().slice(0, 8)}`;
  otherDeckId = crypto.randomUUID();
  otherPublicId = `o-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values([
    { id: deckId, publicId, userId: testUserId, name: 'Test Deck' },
    { id: otherDeckId, publicId: otherPublicId, userId: testUserId, name: 'Other Deck' },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresGameResultsService.getGameResult', () => {
  it('returns the full row including turn_log fields', async () => {
    const resultId = crypto.randomUUID();
    await db.insert(gameResults).values({
      id: resultId,
      deckId,
      result: 'win',
      conceded: false,
      cardResults: [{ cardId: sampleA.talisharCardId, cardName: sampleA.cardName, played: 1, hits: 0, blocked: 0, pitched: 0 }],
      turnLog: [[1, sampleA.talisharCardId, 'M']],
      opponentTurnLog: [[1, sampleB.talisharCardId, 'M']],
      turnResults: { turn_1: { damageDealt: 5 } },
    });

    const res = await service.getGameResult(resultId, deckId);

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toMatchObject({
      id: resultId,
      turnLog: [[1, sampleA.talisharCardId, 'M']],
      opponentTurnLog: [[1, sampleB.talisharCardId, 'M']],
      turnResults: { turn_1: { damageDealt: 5 } },
    });
  });

  it('attaches imageUrls covering both card_results and turn_log cardIds', async () => {
    const resultId = crypto.randomUUID();
    await db.insert(gameResults).values({
      id: resultId,
      deckId,
      result: 'win',
      conceded: false,
      cardResults: [{ cardId: sampleA.talisharCardId, cardName: sampleA.cardName, played: 1, hits: 0, blocked: 0, pitched: 0 }],
      // sampleB appears only in turn_log, not in card_results — the detail
      // endpoint must still resolve its image.
      turnLog: [[1, sampleB.talisharCardId, 'M']],
    });

    const res = await service.getGameResult(resultId, deckId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.imageUrls[sampleA.talisharCardId]).toBe(sampleA.imageUrl);
    expect(res.data.imageUrls[sampleB.talisharCardId]).toBe(sampleB.imageUrl);
  });

  it('normalizes the _equip state suffix on turn_log cardIds', async () => {
    const resultId = crypto.randomUUID();
    const suffixedId = `${equipSample.talisharCardId}_equip`;
    await db.insert(gameResults).values({
      id: resultId,
      deckId,
      result: 'loss',
      conceded: false,
      cardResults: [],
      // Turn-log entries from Talishar include "_equip" suffixes that must
      // be stripped before looking up the cards table.
      turnLog: [[1, suffixedId, 'M']],
    });

    const res = await service.getGameResult(resultId, deckId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    // Map is keyed by the original (un-normalized) cardId as it appears in
    // the turn log, so the client can do a direct lookup.
    expect(res.data.imageUrls[suffixedId]).toBe(equipSample.imageUrl);
  });

  it('returns "Game result not found" when the resultId does not exist for this deck', async () => {
    const res = await service.getGameResult(crypto.randomUUID(), deckId);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toBe('Game result not found');
  });

  it('returns "Game result not found" when the result belongs to a different deck', async () => {
    const resultId = crypto.randomUUID();
    await db.insert(gameResults).values({
      id: resultId,
      deckId: otherDeckId,
      result: 'win',
      conceded: false,
      cardResults: [],
    });

    const res = await service.getGameResult(resultId, deckId);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toBe('Game result not found');
  });
});
