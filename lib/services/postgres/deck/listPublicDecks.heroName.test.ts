/**
 * Integration tests for PostgresDeckService.listPublicDecks heroName matching.
 *
 * Hero names are stored as full display strings ("arakni, marionette"), but
 * chat/API callers ask by the short name ("arakni"). Exact matching made
 * get_decks_to_beat({ heroName: "arakni" }) return nothing even when Arakni
 * decks were featured — substring (case-insensitive) matching fixes it while
 * exact stored names (the Decks to Beat page dropdown) keep working.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
const HERO = 'zz-testhero, the unmatchable';

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    username: `test_${testUserId.slice(0, 8)}`,
    email: `${testUserId.slice(0, 8)}@test.local`,
  } as any);
  await db.insert(decks).values({
    id: crypto.randomUUID(),
    publicId: nanoid(21),
    userId: testUserId,
    name: 'Hero match test deck',
    // 'Casual' dodges the format-size HAVING clause (a 0-card CC deck is
    // filtered out of public listings as invalid).
    format: 'Casual',
    heroName: HERO,
    visibility: 'public',
  } as any);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId)); // cascade removes the deck
});

describe('PostgresDeckService.listPublicDecks heroName', () => {
  it('matches by hero short name (substring, case-insensitive)', async () => {
    const res = await service.listPublicDecks({ heroName: 'ZZ-TestHero' }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.decks.some((d) => d.heroName === HERO)).toBe(true);
  });

  it('still matches the exact stored hero name (page dropdown path)', async () => {
    const res = await service.listPublicDecks({ heroName: HERO }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.decks.some((d) => d.heroName === HERO)).toBe(true);
  });

  it('does not match unrelated heroes', async () => {
    const res = await service.listPublicDecks({ heroName: 'zz-someoneelse' }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.decks.some((d) => d.heroName === HERO)).toBe(false);
  });
});
