/**
 * Integration tests for PostgresCustomTokenCardService.
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, customTokenCardCreators, customTokenCards, cards } from '@/lib/postgres/schema';
import { PostgresCustomTokenCardService } from './PostgresCustomTokenCardService';

const service = new PostgresCustomTokenCardService();

let testUserId: string;
let realCardId: string;
let realCard: typeof cards.$inferSelect;

beforeAll(async () => {
  const [c] = await db.select().from(cards).limit(1);
  if (!c) throw new Error('No cards in DB — cannot run custom-token-card hydration tests');
  realCard = c;
  realCardId = c.cardUniqueId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  // Cascade handles custom_token_card_creators → custom_token_cards
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresCustomTokenCardService.getCreatorByUserId', () => {
  it('returns null when the user has no creator profile', async () => {
    const result = await service.getCreatorByUserId(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBeNull();
  });

  it('returns the DTO when the user has a creator profile', async () => {
    const creatorId = crypto.randomUUID();
    await db.insert(customTokenCardCreators).values({
      id: creatorId,
      userId: testUserId,
      displayName: 'Token Smith',
      slug: `token-smith-${creatorId.slice(0, 8)}`,
    });

    const result = await service.getCreatorByUserId(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe(creatorId);
    // Security contract: userId MUST NOT leak through the public DTO.
    expect(result.data as any).not.toHaveProperty('userId');
    expect(result.data!.displayName).toBe('Token Smith');
    expect(result.data!.isVerified).toBe(false);
    expect(result.data!.bio).toBeNull();
    expect(result.data!.instagramUrl).toBeNull();
  });
});

describe('PostgresCustomTokenCardService.createCreatorProfile', () => {
  it('rejects empty displayName', async () => {
    const result = await service.createCreatorProfile(testUserId, { displayName: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/displayName/i);
  });

  it('creates a profile and auto-generates a slug from displayName', async () => {
    const result = await service.createCreatorProfile(testUserId, { displayName: 'Token Smith & Co.' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Security contract: userId MUST NOT leak through the public DTO.
    expect(result.data as any).not.toHaveProperty('userId');
    expect(result.data.displayName).toBe('Token Smith & Co.');
    expect(result.data.slug).toBe('token-smith-co');
    expect(result.data.tokenCardCount).toBe(0);
  });

  it('rejects when the user already has a creator profile', async () => {
    await service.createCreatorProfile(testUserId, { displayName: 'First' });
    const second = await service.createCreatorProfile(testUserId, { displayName: 'Second' });
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toMatch(/already exists/i);
  });

  it('appends a suffix when the generated slug collides with an existing creator', async () => {
    const otherUserId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    try {
      await service.createCreatorProfile(otherUserId, { displayName: 'Token Smith' });
      const result = await service.createCreatorProfile(testUserId, { displayName: 'Token Smith' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.slug).toBe('token-smith-2');
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });
});

describe('PostgresCustomTokenCardService.updateTokenCard', () => {
  it('returns an error when the token card does not exist', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await service.updateTokenCard(created.data.id, 'nonexistent-id', { name: 'X' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects update when creatorId does not own the token card', async () => {
    const mine = await service.createCreatorProfile(testUserId, { displayName: 'Mine' });
    expect(mine.success).toBe(true);
    if (!mine.success) return;

    const otherUserId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    try {
      const other = await service.createCreatorProfile(otherUserId, { displayName: 'Other' });
      expect(other.success).toBe(true);
      if (!other.success) return;

      const theirs = await service.createTokenCard(other.data.id, { name: 'Theirs' });
      expect(theirs.success).toBe(true);
      if (!theirs.success) return;

      // Attempt to update the other creator's token card using my creator id
      const result = await service.updateTokenCard(mine.data.id, theirs.data.id, { name: 'Hijacked' });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/not authorized/i);
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });

  it('applies partial updates; refreshes stockUpdatedAt when inStock changes', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const tc = await service.createTokenCard(created.data.id, { name: 'T' });
    expect(tc.success).toBe(true);
    if (!tc.success) return;
    expect(tc.data.stockUpdatedAt).toBeNull();

    const before = Date.now();
    const result = await service.updateTokenCard(created.data.id, tc.data.id, { inStock: true, isPublished: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('T'); // untouched
    expect(result.data.inStock).toBe(true);
    expect(result.data.isPublished).toBe(true);
    expect(result.data.stockUpdatedAt).not.toBeNull();
    expect(result.data.stockUpdatedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('clears stockUpdatedAt when inStock is set to null', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const tc = await service.createTokenCard(created.data.id, { name: 'T', inStock: true });
    expect(tc.success).toBe(true);
    if (!tc.success) return;
    expect(tc.data.stockUpdatedAt).not.toBeNull();

    const result = await service.updateTokenCard(created.data.id, tc.data.id, { inStock: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.inStock).toBeNull();
    expect(result.data.stockUpdatedAt).toBeNull();
  });
});

describe('PostgresCustomTokenCardService.deleteTokenCard', () => {
  it('returns an error when the token card does not exist', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await service.deleteTokenCard(created.data.id, 'nonexistent-id');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects delete when creatorId does not own the token card', async () => {
    const mine = await service.createCreatorProfile(testUserId, { displayName: 'Mine' });
    expect(mine.success).toBe(true);
    if (!mine.success) return;

    const otherUserId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    try {
      const other = await service.createCreatorProfile(otherUserId, { displayName: 'Other' });
      expect(other.success).toBe(true);
      if (!other.success) return;

      const theirs = await service.createTokenCard(other.data.id, { name: 'Theirs' });
      expect(theirs.success).toBe(true);
      if (!theirs.success) return;

      const result = await service.deleteTokenCard(mine.data.id, theirs.data.id);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/not authorized/i);

      // Confirm it wasn't deleted
      const stillThere = await service.getTokenCardById(theirs.data.id);
      expect(stillThere.success).toBe(true);
      if (!stillThere.success) return;
      expect(stillThere.data).not.toBeNull();
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });

  it('removes the token card when the owning creator requests it', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const tc = await service.createTokenCard(created.data.id, { name: 'Bye' });
    expect(tc.success).toBe(true);
    if (!tc.success) return;

    const result = await service.deleteTokenCard(created.data.id, tc.data.id);
    expect(result.success).toBe(true);

    const gone = await service.getTokenCardById(tc.data.id);
    expect(gone.success).toBe(true);
    if (!gone.success) return;
    expect(gone.data).toBeNull();
  });
});

describe('PostgresCustomTokenCardService.createTokenCard', () => {
  it('rejects empty name', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await service.createTokenCard(created.data.id, { name: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/name/i);
  });

  it('rejects when the creator does not exist', async () => {
    const result = await service.createTokenCard('nonexistent-id', { name: 'X' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found/i);
  });

  it('creates a token card, default isPublished=false, null stockUpdatedAt when inStock omitted', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await service.createTokenCard(created.data.id, { name: 'My Token' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('My Token');
    expect(result.data.isPublished).toBe(false);
    expect(result.data.inStock).toBeNull();
    expect(result.data.stockUpdatedAt).toBeNull();
    expect(result.data.linkedCard).toBeNull();
  });

  it('sets stockUpdatedAt when inStock is provided', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const before = Date.now();
    const result = await service.createTokenCard(created.data.id, { name: 'T', inStock: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.inStock).toBe(true);
    expect(result.data.stockUpdatedAt).not.toBeNull();
    expect(result.data.stockUpdatedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe('PostgresCustomTokenCardService.getPublishedTokenCardsByCreator', () => {
  it('returns only published token cards for that creator', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await db.insert(customTokenCards).values([
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'pub-1', isPublished: true },
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'pub-2', isPublished: true },
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'draft', isPublished: false },
    ]);

    const result = await service.getPublishedTokenCardsByCreator(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data.every(t => t.isPublished)).toBe(true);
  });

  it('returns empty array when creator has no published token cards', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;
    await db.insert(customTokenCards).values({
      id: crypto.randomUUID(), creatorId: created.data.id, name: 'draft', isPublished: false,
    });

    const result = await service.getPublishedTokenCardsByCreator(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });
});

describe('PostgresCustomTokenCardService.listTokenCardsByCreator', () => {
  it('returns every token card (drafts + published) for that creator', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await db.insert(customTokenCards).values([
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'pub', isPublished: true },
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'draft', isPublished: false },
    ]);

    const result = await service.listTokenCardsByCreator(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
  });

  it('does not leak token cards from other creators', async () => {
    const mine = await service.createCreatorProfile(testUserId, { displayName: 'Mine' });
    expect(mine.success).toBe(true);
    if (!mine.success) return;

    const otherUserId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    try {
      const other = await service.createCreatorProfile(otherUserId, { displayName: 'Other' });
      expect(other.success).toBe(true);
      if (!other.success) return;

      await db.insert(customTokenCards).values([
        { id: crypto.randomUUID(), creatorId: mine.data.id, name: 'mine-1' },
        { id: crypto.randomUUID(), creatorId: other.data.id, name: 'others-1' },
      ]);

      const result = await service.listTokenCardsByCreator(mine.data.id);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('mine-1');
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });
});

describe('PostgresCustomTokenCardService.getTokenCardById', () => {
  it('returns null when no token card has that id', async () => {
    const result = await service.getTokenCardById('no-such-id');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBeNull();
  });

  it('returns the DTO with linkedCard=null when cardUniqueId is not set', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const tokenCardId = crypto.randomUUID();
    await db.insert(customTokenCards).values({
      id: tokenCardId,
      creatorId: created.data.id,
      name: 'Unlinked Token',
    });

    const result = await service.getTokenCardById(tokenCardId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toBeNull();
    expect(result.data!.name).toBe('Unlinked Token');
    expect(result.data!.cardUniqueId).toBeNull();
    expect(result.data!.linkedCard).toBeNull();
  });

  it('hydrates linkedCard metadata from the cards table when cardUniqueId is set', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'C' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const tokenCardId = crypto.randomUUID();
    await db.insert(customTokenCards).values({
      id: tokenCardId,
      creatorId: created.data.id,
      name: 'Linked Token',
      cardUniqueId: realCardId,
    });

    const result = await service.getTokenCardById(tokenCardId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data!.cardUniqueId).toBe(realCardId);
    expect(result.data!.linkedCard).not.toBeNull();
    expect(result.data!.linkedCard!.cardUniqueId).toBe(realCardId);
    expect(result.data!.linkedCard!.displayName).toBe(realCard.displayName);
  });
});

describe('PostgresCustomTokenCardService.listCreators', () => {
  it('returns verified creators before unverified ones', async () => {
    const otherUserId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    try {
      const verified = await service.createCreatorProfile(testUserId, { displayName: 'Verified One' });
      const unverified = await service.createCreatorProfile(otherUserId, { displayName: 'Unverified Two' });
      expect(verified.success && unverified.success).toBe(true);
      if (!verified.success || !unverified.success) return;

      await db.update(customTokenCardCreators)
        .set({ isVerified: true })
        .where(eq(customTokenCardCreators.id, verified.data.id));

      const result = await service.listCreators();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const mine = result.data.filter(c => [verified.data.id, unverified.data.id].includes(c.id));
      expect(mine.length).toBe(2);
      expect(mine[0].id).toBe(verified.data.id);
      expect(mine[0].isVerified).toBe(true);
      expect(mine[1].id).toBe(unverified.data.id);
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });

  it('populates tokenCardCount only for published token cards per creator', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'Counter' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await db.insert(customTokenCards).values([
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'pub', isPublished: true },
      { id: crypto.randomUUID(), creatorId: created.data.id, name: 'draft', isPublished: false },
    ]);

    const result = await service.listCreators();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const mine = result.data.find(c => c.id === created.data.id);
    expect(mine?.tokenCardCount).toBe(1);
  });
});

describe('PostgresCustomTokenCardService.updateCreatorProfile', () => {
  it('returns an error when the creator does not exist', async () => {
    const result = await service.updateCreatorProfile('nonexistent-id', { displayName: 'X' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found/i);
  });

  it('applies partial updates without touching unspecified fields', async () => {
    const created = await service.createCreatorProfile(testUserId, { displayName: 'Original', bio: 'keep me' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await service.updateCreatorProfile(created.data.id, { instagramUrl: 'https://instagram.com/xyz' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.displayName).toBe('Original');
    expect(result.data.bio).toBe('keep me');
    expect(result.data.instagramUrl).toBe('https://instagram.com/xyz');
  });

  it('regenerates slug uniquely when slug is updated', async () => {
    const otherUserId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    try {
      await service.createCreatorProfile(otherUserId, { displayName: 'Taken Slug' });
      const mine = await service.createCreatorProfile(testUserId, { displayName: 'Mine' });
      expect(mine.success).toBe(true);
      if (!mine.success) return;

      const result = await service.updateCreatorProfile(mine.data.id, { slug: 'Taken Slug' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.slug).toBe('taken-slug-2');
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });
});

describe('PostgresCustomTokenCardService.getCreatorBySlug', () => {
  it('returns null when no creator has the slug', async () => {
    const result = await service.getCreatorBySlug(`nope-${crypto.randomUUID().slice(0, 8)}`);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBeNull();
  });

  it('returns the DTO with tokenCardCount reflecting only published token cards', async () => {
    const creatorId = crypto.randomUUID();
    const slug = `slug-${creatorId.slice(0, 8)}`;
    await db.insert(customTokenCardCreators).values({
      id: creatorId,
      userId: testUserId,
      displayName: 'Token Smith',
      slug,
    });
    // Two published, one draft
    await db.insert(customTokenCards).values([
      { id: crypto.randomUUID(), creatorId, name: 'A', isPublished: true },
      { id: crypto.randomUUID(), creatorId, name: 'B', isPublished: true },
      { id: crypto.randomUUID(), creatorId, name: 'C', isPublished: false },
    ]);

    const result = await service.getCreatorBySlug(slug);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe(creatorId);
    expect(result.data!.tokenCardCount).toBe(2);
  });
});
