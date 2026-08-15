/**
 * Integration test: deck `folder` — a free-form, user-defined string used to
 * organize decks on /decks (e.g. "Physical decks", "Brewing"). Nullable, trimmed,
 * empty string clears it, capped at DECK_FOLDER_MAX_LENGTH chars.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';
import { DECK_FOLDER_MAX_LENGTH } from '@/lib/services/contracts/IDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let deckId: string;
let publicId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  publicId = `fld-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({
    id: deckId,
    publicId,
    userId: testUserId,
    name: `Folder test ${deckId}`,
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('deck folder', () => {
  it('updateDeck persists a trimmed folder and both DTO shapes expose it', async () => {
    const upd = await service.updateDeck(publicId, testUserId, { folder: '  Physical decks  ' });
    expect(upd.success).toBe(true);
    if (!upd.success) return;
    expect(upd.data.folder).toBe('Physical decks');

    const list = await service.listUserDecksBasic(testUserId);
    expect(list.success).toBe(true);
    if (!list.success) return;
    expect(list.data.find(d => d._id === deckId)?.folder).toBe('Physical decks');

    const full = await service.findByPublicId(publicId);
    expect(full.success).toBe(true);
    if (!full.success) return;
    expect(full.data.folder).toBe('Physical decks');
  });

  it('a deck with no folder reports folder: null on the summary DTO', async () => {
    const list = await service.listUserDecksBasic(testUserId);
    expect(list.success).toBe(true);
    if (!list.success) return;
    expect(list.data.find(d => d._id === deckId)?.folder).toBeNull();
  });

  it('empty / whitespace-only folder clears it to null', async () => {
    await service.updateDeck(publicId, testUserId, { folder: 'Brewing' });
    const cleared = await service.updateDeck(publicId, testUserId, { folder: '   ' });
    expect(cleared.success).toBe(true);
    if (!cleared.success) return;
    expect(cleared.data.folder).toBeNull();

    await service.updateDeck(publicId, testUserId, { folder: 'Brewing' });
    const nulled = await service.updateDeck(publicId, testUserId, { folder: null });
    expect(nulled.success).toBe(true);
    if (!nulled.success) return;
    expect(nulled.data.folder).toBeNull();
  });

  it('omitting folder from an update leaves the existing folder untouched', async () => {
    await service.updateDeck(publicId, testUserId, { folder: 'Brewing' });
    const upd = await service.updateDeck(publicId, testUserId, { description: 'new desc' });
    expect(upd.success).toBe(true);
    if (!upd.success) return;
    expect(upd.data.folder).toBe('Brewing');
  });

  it('rejects a folder longer than DECK_FOLDER_MAX_LENGTH', async () => {
    const tooLong = 'x'.repeat(DECK_FOLDER_MAX_LENGTH + 1);
    const upd = await service.updateDeck(publicId, testUserId, { folder: tooLong });
    expect(upd.success).toBe(false);
    if (upd.success) return;
    expect(upd.error).toMatch(/folder/i);
  });
});
