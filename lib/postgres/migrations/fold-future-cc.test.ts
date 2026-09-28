/**
 * Pins migration 0121: Future Classic Constructed is folded into Classic
 * Constructed (CC decks now take spoiler-season cards), so every deck stored
 * with the retired format becomes a CC deck. Other formats are untouched, and
 * re-running the migration is a no-op.
 *
 * Runs against the local DB (POSTGRES_URL via vitest.setup.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';

const MIGRATION = join(process.cwd(), 'lib/postgres/migrations/0121_fold_future_cc_into_cc.sql');

const userId = crypto.randomUUID();
const futureDeck = nanoid(21);
const sageDeck = nanoid(21);

beforeAll(async () => {
  await db.insert(users).values({ id: userId, username: `test-${userId}` });
  await db.insert(decks).values([
    { id: futureDeck, publicId: nanoid(21), userId, name: 'fcc', slug: `s-${futureDeck}`, format: 'Future Classic Constructed', heroName: 'malice, domina of the dead', visibility: 'private' },
    { id: sageDeck, publicId: nanoid(21), userId, name: 'sa', slug: `s-${sageDeck}`, format: 'Silver Age', heroName: 'malice', visibility: 'private' },
  ]);
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId));
});

const formatOf = async (id: string) =>
  (await db.select({ format: decks.format }).from(decks).where(eq(decks.id, id)))[0]?.format;

describe('migration 0121 — fold Future CC into CC', () => {
  it('turns Future CC decks into CC decks, leaves other formats alone, and is idempotent', async () => {
    const statement = readFileSync(MIGRATION, 'utf8');
    await db.execute(sql.raw(statement));
    await db.execute(sql.raw(statement));

    expect(await formatOf(futureDeck)).toBe('Classic Constructed');
    expect(await formatOf(sageDeck)).toBe('Silver Age');
    const leftover = await db.select({ id: decks.id }).from(decks)
      .where(inArray(decks.format, ['Future Classic Constructed']));
    expect(leftover).toEqual([]);
  });
});
