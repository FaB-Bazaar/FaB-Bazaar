/**
 * Integration test: listUserDecksBasic must surface eventName, eventDate,
 * and placing on each summary DTO so the DeckSettings dialog can prefill
 * existing event metadata.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let eventDeckId: string;
let eventPublicId: string;
let plainDeckId: string;
let plainPublicId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  eventDeckId = crypto.randomUUID();
  eventPublicId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  plainDeckId = crypto.randomUUID();
  plainPublicId = `pln-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  await db.insert(decks).values([
    {
      id: eventDeckId,
      publicId: eventPublicId,
      userId: testUserId,
      name: `Event ${eventDeckId}`,
      eventName: 'Calling Vegas 2026',
      eventDate: '2026-04-15',
      placing: 3,
    },
    {
      id: plainDeckId,
      publicId: plainPublicId,
      userId: testUserId,
      name: `Plain ${plainDeckId}`,
    },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('listUserDecksBasic event metadata', () => {
  it('returns eventName, eventDate, and placing on the summary DTO', async () => {
    const result = await service.listUserDecksBasic(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const eventDeck = result.data.find(d => d._id === eventDeckId);
    const plainDeck = result.data.find(d => d._id === plainDeckId);

    expect(eventDeck?.eventName).toBe('Calling Vegas 2026');
    expect(eventDeck?.eventDate).toBe('2026-04-15');
    expect(eventDeck?.placing).toBe(3);

    expect(plainDeck?.eventName).toBeNull();
    expect(plainDeck?.eventDate).toBeNull();
    expect(plainDeck?.placing).toBeNull();
  });
});
