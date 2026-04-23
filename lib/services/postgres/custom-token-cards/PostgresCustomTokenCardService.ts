import { db } from '@/lib/postgres/db';
import { customTokenCardCreators, customTokenCards, cards } from '@/lib/postgres/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'creator';
}

function toTokenCardDTO(
  row: typeof customTokenCards.$inferSelect,
  linkedCard: LinkedCardMetadataDTO | null,
): CustomTokenCardDTO {
  return {
    id: row.id,
    creatorId: row.creatorId,
    cardUniqueId: row.cardUniqueId ?? null,
    externalId: row.externalId ?? null,
    name: row.name,
    description: row.description ?? null,
    imageUrl: row.imageUrl ?? null,
    purchaseUrl: row.purchaseUrl ?? null,
    inStock: row.inStock ?? null,
    stockUpdatedAt: row.stockUpdatedAt ?? null,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    linkedCard,
  };
}

async function hydrateLinkedCards(rows: Array<typeof customTokenCards.$inferSelect>): Promise<CustomTokenCardDTO[]> {
  const cardIds = rows.map(r => r.cardUniqueId).filter((v): v is string => !!v);
  if (cardIds.length === 0) return rows.map(r => toTokenCardDTO(r, null));

  const cardRows = await db
    .select({
      cardUniqueId: cards.cardUniqueId,
      displayName: cards.displayName,
      types: cards.types,
      color: cards.color,
      typeTextDisplay: cards.typeTextDisplay,
    })
    .from(cards)
    .where(inArray(cards.cardUniqueId, cardIds));

  const cardMap = new Map<string, LinkedCardMetadataDTO>(
    cardRows.map(c => [c.cardUniqueId, {
      cardUniqueId: c.cardUniqueId,
      displayName: c.displayName ?? null,
      types: c.types ?? null,
      color: c.color ?? null,
      typeTextDisplay: c.typeTextDisplay ?? null,
    }])
  );

  return rows.map(r => toTokenCardDTO(r, r.cardUniqueId ? cardMap.get(r.cardUniqueId) ?? null : null));
}

async function resolveUniqueSlug(base: string, excludeCreatorId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db
      .select({ id: customTokenCardCreators.id })
      .from(customTokenCardCreators)
      .where(eq(customTokenCardCreators.slug, candidate))
      .limit(1);
    const collides = existing[0] && existing[0].id !== excludeCreatorId;
    if (!collides) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}
import type {
  ICustomTokenCardService,
  CustomTokenCardCreatorDTO,
  CustomTokenCardDTO,
  LinkedCardMetadataDTO,
  CreateCreatorProfileInput,
  UpdateCreatorProfileInput,
  CreateCustomTokenCardInput,
  UpdateCustomTokenCardInput,
} from '../../contracts/ICustomTokenCardService';
import type { AsyncResult } from '../../contracts/common';

function toCreatorDTO(row: typeof customTokenCardCreators.$inferSelect): CustomTokenCardCreatorDTO {
  return {
    id: row.id,
    displayName: row.displayName,
    slug: row.slug,
    bio: row.bio ?? null,
    avatarUrl: row.avatarUrl ?? null,
    isVerified: row.isVerified,
    websiteUrl: row.websiteUrl ?? null,
    shopUrl: row.shopUrl ?? null,
    instagramUrl: row.instagramUrl ?? null,
    facebookUrl: row.facebookUrl ?? null,
    xUrl: row.xUrl ?? null,
    blueskyUrl: row.blueskyUrl ?? null,
    discordInviteUrl: row.discordInviteUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * PostgreSQL implementation — being rebuilt via strict TDD.
 * Every method throws until a failing test drives its implementation.
 */
export class PostgresCustomTokenCardService implements ICustomTokenCardService {
  async getCreatorByUserId(userId: string): AsyncResult<CustomTokenCardCreatorDTO | null> {
    try {
      const [row] = await db
        .select()
        .from(customTokenCardCreators)
        .where(eq(customTokenCardCreators.userId, userId))
        .limit(1);
      return { success: true, data: row ? toCreatorDTO(row) : null };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get creator by user id' };
    }
  }
  async getCreatorBySlug(slug: string): AsyncResult<CustomTokenCardCreatorDTO | null> {
    try {
      const [row] = await db
        .select()
        .from(customTokenCardCreators)
        .where(eq(customTokenCardCreators.slug, slug))
        .limit(1);
      if (!row) return { success: true, data: null };

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customTokenCards)
        .where(and(eq(customTokenCards.creatorId, row.id), eq(customTokenCards.isPublished, true)));

      return { success: true, data: { ...toCreatorDTO(row), tokenCardCount: Number(count) } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get creator by slug' };
    }
  }
  async listCreators(): AsyncResult<CustomTokenCardCreatorDTO[]> {
    try {
      const rows = await db
        .select()
        .from(customTokenCardCreators)
        .orderBy(desc(customTokenCardCreators.isVerified), desc(customTokenCardCreators.createdAt));

      if (rows.length === 0) return { success: true, data: [] };

      const countRows = await db
        .select({ creatorId: customTokenCards.creatorId, count: sql<number>`count(*)::int` })
        .from(customTokenCards)
        .where(and(
          inArray(customTokenCards.creatorId, rows.map(r => r.id)),
          eq(customTokenCards.isPublished, true),
        ))
        .groupBy(customTokenCards.creatorId);

      const countMap = new Map(countRows.map(r => [r.creatorId, Number(r.count)]));
      return { success: true, data: rows.map(r => ({ ...toCreatorDTO(r), tokenCardCount: countMap.get(r.id) ?? 0 })) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list creators' };
    }
  }
  async createCreatorProfile(userId: string, input: CreateCreatorProfileInput): AsyncResult<CustomTokenCardCreatorDTO> {
    try {
      if (!input.displayName?.trim()) {
        return { success: false, error: 'displayName is required' };
      }

      const existing = await db
        .select({ id: customTokenCardCreators.id })
        .from(customTokenCardCreators)
        .where(eq(customTokenCardCreators.userId, userId))
        .limit(1);
      if (existing[0]) {
        return { success: false, error: 'Creator profile already exists for this user' };
      }

      const slug = await resolveUniqueSlug(input.slug || input.displayName);
      const id = nanoid();

      const [row] = await db
        .insert(customTokenCardCreators)
        .values({
          id,
          userId,
          displayName: input.displayName.trim(),
          slug,
          bio: input.bio ?? null,
          avatarUrl: input.avatarUrl ?? null,
          websiteUrl: input.websiteUrl ?? null,
          shopUrl: input.shopUrl ?? null,
          instagramUrl: input.instagramUrl ?? null,
          facebookUrl: input.facebookUrl ?? null,
          xUrl: input.xUrl ?? null,
          blueskyUrl: input.blueskyUrl ?? null,
          discordInviteUrl: input.discordInviteUrl ?? null,
        })
        .returning();

      return { success: true, data: { ...toCreatorDTO(row), tokenCardCount: 0 } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create creator profile' };
    }
  }
  async updateCreatorProfile(creatorId: string, input: UpdateCreatorProfileInput): AsyncResult<CustomTokenCardCreatorDTO> {
    try {
      const [existing] = await db
        .select()
        .from(customTokenCardCreators)
        .where(eq(customTokenCardCreators.id, creatorId))
        .limit(1);
      if (!existing) return { success: false, error: 'Creator profile not found' };

      const updates: Partial<typeof customTokenCardCreators.$inferInsert> = { updatedAt: new Date() };
      if (input.displayName !== undefined) updates.displayName = input.displayName.trim();
      if (input.slug !== undefined) updates.slug = await resolveUniqueSlug(input.slug, creatorId);
      if (input.bio !== undefined) updates.bio = input.bio || null;
      if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl || null;
      if (input.websiteUrl !== undefined) updates.websiteUrl = input.websiteUrl || null;
      if (input.shopUrl !== undefined) updates.shopUrl = input.shopUrl || null;
      if (input.instagramUrl !== undefined) updates.instagramUrl = input.instagramUrl || null;
      if (input.facebookUrl !== undefined) updates.facebookUrl = input.facebookUrl || null;
      if (input.xUrl !== undefined) updates.xUrl = input.xUrl || null;
      if (input.blueskyUrl !== undefined) updates.blueskyUrl = input.blueskyUrl || null;
      if (input.discordInviteUrl !== undefined) updates.discordInviteUrl = input.discordInviteUrl || null;

      const [row] = await db
        .update(customTokenCardCreators)
        .set(updates)
        .where(eq(customTokenCardCreators.id, creatorId))
        .returning();

      return { success: true, data: toCreatorDTO(row) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update creator profile' };
    }
  }
  async getTokenCardById(tokenCardId: string): AsyncResult<CustomTokenCardDTO | null> {
    try {
      const [row] = await db
        .select()
        .from(customTokenCards)
        .where(eq(customTokenCards.id, tokenCardId))
        .limit(1);
      if (!row) return { success: true, data: null };
      const [hydrated] = await hydrateLinkedCards([row]);
      return { success: true, data: hydrated };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get token card by id' };
    }
  }
  async getPublishedTokenCardsByCreator(creatorId: string): AsyncResult<CustomTokenCardDTO[]> {
    try {
      const rows = await db
        .select()
        .from(customTokenCards)
        .where(and(eq(customTokenCards.creatorId, creatorId), eq(customTokenCards.isPublished, true)))
        .orderBy(desc(customTokenCards.createdAt));
      return { success: true, data: await hydrateLinkedCards(rows) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get published token cards' };
    }
  }

  async listTokenCardsByCreator(creatorId: string): AsyncResult<CustomTokenCardDTO[]> {
    try {
      const rows = await db
        .select()
        .from(customTokenCards)
        .where(eq(customTokenCards.creatorId, creatorId))
        .orderBy(desc(customTokenCards.createdAt));
      return { success: true, data: await hydrateLinkedCards(rows) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list token cards' };
    }
  }
  async createTokenCard(creatorId: string, input: CreateCustomTokenCardInput): AsyncResult<CustomTokenCardDTO> {
    try {
      if (!input.name?.trim()) return { success: false, error: 'name is required' };

      const [creator] = await db
        .select({ id: customTokenCardCreators.id })
        .from(customTokenCardCreators)
        .where(eq(customTokenCardCreators.id, creatorId))
        .limit(1);
      if (!creator) return { success: false, error: 'Creator profile not found' };

      const [row] = await db
        .insert(customTokenCards)
        .values({
          id: nanoid(),
          creatorId,
          cardUniqueId: input.cardUniqueId ?? null,
          externalId: input.externalId ?? null,
          name: input.name.trim(),
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          purchaseUrl: input.purchaseUrl ?? null,
          inStock: input.inStock ?? null,
          stockUpdatedAt: input.inStock !== undefined && input.inStock !== null ? new Date() : null,
          isPublished: input.isPublished ?? false,
        })
        .returning();

      const [hydrated] = await hydrateLinkedCards([row]);
      return { success: true, data: hydrated };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create token card' };
    }
  }
  async updateTokenCard(creatorId: string, tokenCardId: string, input: UpdateCustomTokenCardInput): AsyncResult<CustomTokenCardDTO> {
    try {
      const [existing] = await db
        .select()
        .from(customTokenCards)
        .where(eq(customTokenCards.id, tokenCardId))
        .limit(1);
      if (!existing) return { success: false, error: 'Token card not found' };
      if (existing.creatorId !== creatorId) {
        return { success: false, error: 'Not authorized to modify this token card' };
      }

      const updates: Partial<typeof customTokenCards.$inferInsert> = { updatedAt: new Date() };
      if (input.cardUniqueId !== undefined) updates.cardUniqueId = input.cardUniqueId;
      if (input.externalId !== undefined) updates.externalId = input.externalId;
      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.description !== undefined) updates.description = input.description;
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;
      if (input.purchaseUrl !== undefined) updates.purchaseUrl = input.purchaseUrl;
      if (input.inStock !== undefined) {
        updates.inStock = input.inStock;
        updates.stockUpdatedAt = input.inStock === null ? null : new Date();
      }
      if (input.isPublished !== undefined) updates.isPublished = input.isPublished;

      const [row] = await db
        .update(customTokenCards)
        .set(updates)
        .where(eq(customTokenCards.id, tokenCardId))
        .returning();

      const [hydrated] = await hydrateLinkedCards([row]);
      return { success: true, data: hydrated };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update token card' };
    }
  }

  async deleteTokenCard(creatorId: string, tokenCardId: string): AsyncResult<void> {
    try {
      const [existing] = await db
        .select({ id: customTokenCards.id, creatorId: customTokenCards.creatorId })
        .from(customTokenCards)
        .where(eq(customTokenCards.id, tokenCardId))
        .limit(1);
      if (!existing) return { success: false, error: 'Token card not found' };
      if (existing.creatorId !== creatorId) {
        return { success: false, error: 'Not authorized to delete this token card' };
      }

      await db.delete(customTokenCards).where(eq(customTokenCards.id, tokenCardId));
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete token card' };
    }
  }
}
