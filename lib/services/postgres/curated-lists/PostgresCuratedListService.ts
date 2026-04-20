import { db } from '@/lib/postgres/db';
import { curatedLists, curatedListCards, curatorHeroAssignments, printings, cards, users } from '@/lib/postgres/schema';
import { eq, asc, or, isNull, and, inArray, sql } from 'drizzle-orm';
import { getHeroInfo, normalizeHeroName, normalizeClassName } from '@/lib/fab-constants/heroes';
import { displayUsername } from '@/lib/utils/display-username';
import { nanoid } from 'nanoid';
import type {
  ICuratedListService,
  CuratedListDTO,
  CuratedListCardDTO,
  CuratorAttributionDTO,
  CreateCuratedListInput,
  UpdateCuratedListInput,
  VariantType,
  HeroKitSummaryDTO,
} from '../../contracts/ICuratedListService';
import type { AsyncResult } from '../../contracts/common';

export class PostgresCuratedListService implements ICuratedListService {
  private toDTO(
    row: typeof curatedLists.$inferSelect,
    cardList?: CuratedListCardDTO[],
    curatorUser?: CuratorAttributionDTO | null,
    cardCount?: number,
  ): CuratedListDTO {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      heroName: row.heroName ?? null,
      className: row.className ?? null,
      format: row.format ?? null,
      tags: row.tags ?? [],
      isPublished: row.isPublished,
      sortOrder: row.sortOrder ?? 0,
      parentId: row.parentId ?? null,
      variantType: (row.variantType as VariantType | null) ?? null,
      createdBy: row.createdBy ?? null,
      curatorUser: curatorUser ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      cards: cardList,
      cardCount: cardCount ?? cardList?.length,
    };
  }

  private async fetchCardCounts(listIds: string[]): Promise<Map<string, number>> {
    if (listIds.length === 0) return new Map();
    const rows = await db
      .select({
        listId: curatedListCards.listId,
        count: sql<number>`count(*)::int`,
      })
      .from(curatedListCards)
      .where(inArray(curatedListCards.listId, listIds))
      .groupBy(curatedListCards.listId);
    return new Map(rows.map(r => [r.listId, Number(r.count)]));
  }

  private async fetchCardsForList(listId: string): Promise<CuratedListCardDTO[]> {
    const rows = await db
      .select({
        id: curatedListCards.id,
        listId: curatedListCards.listId,
        printingId: curatedListCards.printingId,
        cardUniqueId: printings.cardUniqueId,
        sortOrder: curatedListCards.sortOrder,
        comment: curatedListCards.comment,
        displayName: cards.displayName,
        imageUrl: printings.imageUrl,
        setCode: printings.set,
        collectorNumber: printings.collectorNumber,
        rarity: printings.rarity,
        foiling: printings.foiling,
        edition: printings.edition,
        types: cards.types,
        keywords: cards.keywords,
        color: cards.color,
        typeTextDisplay: cards.typeTextDisplay,
        tcgLow: printings.tcgLow,
        tcgMarket: printings.tcgMarket,
        tcgMid: printings.tcgMid,
        tcgHigh: printings.tcgHigh,
        tcgplayerUrl: printings.tcgplayerUrl,
        isExtendedArt: printings.isExtendedArt,
        artVariations: printings.artVariations,
        foilInsetTop: printings.foilInsetTop,
        foilInsetRight: printings.foilInsetRight,
        foilInsetBottom: printings.foilInsetBottom,
        foilInsetLeft: printings.foilInsetLeft,
        foilInsetRound: printings.foilInsetRound,
      })
      .from(curatedListCards)
      .leftJoin(printings, eq(curatedListCards.printingId, printings.printingId))
      .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(eq(curatedListCards.listId, listId))
      .orderBy(asc(curatedListCards.sortOrder));

    return rows.map(row => ({
      id: row.id,
      listId: row.listId,
      printingId: row.printingId,
      cardUniqueId: row.cardUniqueId ?? undefined,
      sortOrder: row.sortOrder ?? 0,
      comment: row.comment ?? null,
      displayName: row.displayName ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      setCode: row.setCode ?? undefined,
      collectorNumber: row.collectorNumber ?? undefined,
      rarity: row.rarity ?? undefined,
      foiling: row.foiling ?? undefined,
      edition: row.edition ?? undefined,
      types: row.types ?? undefined,
      keywords: row.keywords ?? undefined,
      color: row.color ?? undefined,
      typeTextDisplay: row.typeTextDisplay ?? undefined,
      tcgLow: row.tcgLow ?? undefined,
      tcgMarket: row.tcgMarket ?? undefined,
      tcgMid: row.tcgMid ?? undefined,
      tcgHigh: row.tcgHigh ?? undefined,
      tcgplayerUrl: row.tcgplayerUrl ?? undefined,
      isExtendedArt: row.isExtendedArt ?? undefined,
      artVariations: row.artVariations ?? undefined,
      foilInsetTop: row.foilInsetTop ?? undefined,
      foilInsetRight: row.foilInsetRight ?? undefined,
      foilInsetBottom: row.foilInsetBottom ?? undefined,
      foilInsetLeft: row.foilInsetLeft ?? undefined,
      foilInsetRound: row.foilInsetRound ?? undefined,
    }));
  }

  async getPublishedListsForHero(heroName?: string): AsyncResult<CuratedListDTO[]> {
    try {
      // Resolve the hero's class to also include class-level lists
      const heroClass = heroName ? (getHeroInfo(heroName)?.classes?.[0] ?? null) : null;

      let heroFilter;
      if (heroName) {
        // Include: this specific hero OR general (no hero, no class) OR this hero's class
        const conditions = [
          eq(sql`lower(${curatedLists.heroName})`, heroName.toLowerCase()),
          and(isNull(curatedLists.heroName), isNull(curatedLists.className)),
        ];
        if (heroClass) {
          conditions.push(eq(sql`lower(${curatedLists.className})`, heroClass.toLowerCase()) as any);
        }
        heroFilter = or(...conditions);
      } else {
        // No hero specified: only general lists
        heroFilter = and(isNull(curatedLists.heroName), isNull(curatedLists.className));
      }

      const rows = await db
        .select({
          list: curatedLists,
          user: {
            id: users.id,
            username: users.username,
            displayUsername: users.displayUsername,
            avatarUrl: users.avatarUrl,
          },
          assignment: {
            metafyProductUrl: curatorHeroAssignments.metafyProductUrl,
          },
        })
        .from(curatedLists)
        .leftJoin(users, eq(curatedLists.createdBy, users.id))
        .leftJoin(
          curatorHeroAssignments,
          and(
            eq(curatorHeroAssignments.userId, curatedLists.createdBy),
            sql`lower(${curatorHeroAssignments.heroName}) = lower(${curatedLists.heroName})`
          )
        )
        .where(and(heroFilter, eq(curatedLists.isPublished, true)))
        .orderBy(asc(curatedLists.sortOrder));

      const result: CuratedListDTO[] = await Promise.all(
        rows.map(async ({ list, user, assignment }) => {
          const cardList = await this.fetchCardsForList(list.id);
          const curatorUser: CuratorAttributionDTO | null = user.id ? {
            userId: user.id,
            username: user.username,
            displayUsername: displayUsername(user.displayUsername ?? user.username),
            avatarUrl: user.avatarUrl ?? null,
            metafyProductUrl: assignment?.metafyProductUrl ?? null,
          } : null;
          return this.toDTO(list, cardList, curatorUser);
        })
      );

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published lists for hero',
      };
    }
  }

  async getAllPublished(options: { includeCards?: boolean } = {}): AsyncResult<CuratedListDTO[]> {
    try {
      const rows = await db
        .select()
        .from(curatedLists)
        .where(eq(curatedLists.isPublished, true))
        .orderBy(asc(curatedLists.sortOrder));

      if (options.includeCards) {
        const data = await Promise.all(
          rows.map(async row => {
            const cardList = await this.fetchCardsForList(row.id);
            return this.toDTO(row, cardList, undefined);
          })
        );
        return { success: true, data };
      }

      const counts = await this.fetchCardCounts(rows.map(r => r.id));
      return { success: true, data: rows.map(row => this.toDTO(row, undefined, undefined, counts.get(row.id) ?? 0)) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all published lists',
      };
    }
  }

  async getHeroSummaries(format: string): AsyncResult<HeroKitSummaryDTO[]> {
    try {
      // Cap-aware per-hero aggregation done entirely in SQL to avoid shipping
      // thousands of card rows. Cap logic mirrors `capForCard` in lib/utils/card-pool.ts:
      //   weapon → 2, equipment+evo → 3, equipment (alone) → 1, else → 3
      //
      // Cards are grouped by card_unique_id within each hero; rawCount is the total
      // copies across all that hero's kits. We use MIN(tcg_low) for the per-card price —
      // close enough to the TS "first occurrence" semantic and deterministic in SQL.
      const rows = await db.execute<{
        hero_name: string | null;
        kit_count: number;
        total_tcg_low: number;
      }>(sql`
        WITH filtered_lists AS (
          SELECT id, hero_name
          FROM curated_lists
          WHERE is_published = true
            AND lower(coalesce(format, '')) = lower(${format})
        ),
        per_card AS (
          SELECT
            fl.hero_name,
            p.card_unique_id,
            COUNT(*)::int AS raw_count,
            CASE
              WHEN 'weapon' = ANY(c.types) THEN 2
              WHEN 'equipment' = ANY(c.types) AND 'evo' = ANY(c.types) THEN 3
              WHEN 'equipment' = ANY(c.types) THEN 1
              ELSE 3
            END AS cap,
            MIN(p.tcg_low) AS tcg_low
          FROM curated_list_cards clc
          JOIN filtered_lists fl ON fl.id = clc.list_id
          JOIN printings p ON p.printing_id = clc.printing_id
          JOIN cards c ON c.card_unique_id = p.card_unique_id
          GROUP BY fl.hero_name, p.card_unique_id, c.types
        ),
        hero_totals AS (
          SELECT
            hero_name,
            SUM(LEAST(raw_count, cap) * COALESCE(tcg_low, 0))::float AS total_tcg_low
          FROM per_card
          GROUP BY hero_name
        ),
        kit_counts AS (
          SELECT hero_name, COUNT(*)::int AS kit_count
          FROM filtered_lists
          GROUP BY hero_name
        )
        SELECT
          kc.hero_name,
          kc.kit_count,
          COALESCE(ht.total_tcg_low, 0)::float AS total_tcg_low
        FROM kit_counts kc
        LEFT JOIN hero_totals ht USING (hero_name)
      `);

      // drizzle's `.execute()` returns `{ rows }` for pg driver.
      const resultRows = (rows as unknown as { rows: Array<{ hero_name: string | null; kit_count: number; total_tcg_low: number }> }).rows
        ?? (rows as unknown as Array<{ hero_name: string | null; kit_count: number; total_tcg_low: number }>);

      const data: HeroKitSummaryDTO[] = resultRows.map(r => ({
        heroName: r.hero_name,
        kitCount: Number(r.kit_count),
        totalTcgLow: Number(r.total_tcg_low),
      }));

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get hero summaries',
      };
    }
  }

  async getAllLists(): AsyncResult<CuratedListDTO[]> {
    try {
      const rows = await db
        .select()
        .from(curatedLists)
        .orderBy(asc(curatedLists.sortOrder));

      const counts = await this.fetchCardCounts(rows.map(r => r.id));
      return { success: true, data: rows.map(row => this.toDTO(row, undefined, undefined, counts.get(row.id) ?? 0)) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all lists',
      };
    }
  }

  async getListsForCurator(userId: string): AsyncResult<CuratedListDTO[]> {
    try {
      const assignmentRows = await db
        .select({ heroName: curatorHeroAssignments.heroName, metafyProductUrl: curatorHeroAssignments.metafyProductUrl })
        .from(curatorHeroAssignments)
        .where(eq(curatorHeroAssignments.userId, userId));

      if (assignmentRows.length === 0) {
        return { success: true, data: [] };
      }

      const heroNames = assignmentRows.map(r => r.heroName.toLowerCase());
      const metafyMap = new Map(assignmentRows.map(r => [r.heroName.toLowerCase(), r.metafyProductUrl ?? null]));

      const [userRow] = await db
        .select({ id: users.id, username: users.username, displayUsername: users.displayUsername, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId));

      const rows = await db
        .select()
        .from(curatedLists)
        .where(inArray(sql`lower(${curatedLists.heroName})`, heroNames))
        .orderBy(asc(curatedLists.sortOrder));

      const curatorUser: CuratorAttributionDTO | null = userRow ? {
        userId: userRow.id,
        username: userRow.username,
        displayUsername: displayUsername(userRow.displayUsername ?? userRow.username),
        avatarUrl: userRow.avatarUrl ?? null,
        metafyProductUrl: null,
      } : null;

      const counts = await this.fetchCardCounts(rows.map(r => r.id));
      return {
        success: true,
        data: rows.map(row => {
          const heroKey = (row.heroName ?? '').toLowerCase();
          const withMetafy = curatorUser ? { ...curatorUser, metafyProductUrl: metafyMap.get(heroKey) ?? null } : null;
          return this.toDTO(row, undefined, withMetafy, counts.get(row.id) ?? 0);
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get lists for curator',
      };
    }
  }

  async getListById(id: string): AsyncResult<CuratedListDTO> {
    try {
      const [row] = await db
        .select()
        .from(curatedLists)
        .where(eq(curatedLists.id, id));

      if (!row) {
        return { success: false, error: 'Curated list not found' };
      }

      const cardList = await this.fetchCardsForList(id);
      return { success: true, data: this.toDTO(row, cardList) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get list by id',
      };
    }
  }

  async createList(userId: string, input: CreateCuratedListInput): AsyncResult<CuratedListDTO> {
    try {
      if (!input.name?.trim()) {
        return { success: false, error: 'name is required' };
      }
      if (!input.format?.trim()) {
        return { success: false, error: 'format is required (Classic Constructed, Silver Age, Living Legend, Blitz)' };
      }

      const id = nanoid();
      const now = new Date();

      const [row] = await db
        .insert(curatedLists)
        .values({
          id,
          name: input.name.trim(),
          description: input.description ?? null,
          heroName: normalizeHeroName(input.heroName),
          className: normalizeClassName(input.className),
          format: input.format.trim(),
          tags: input.tags ?? [],
          isPublished: false,
          sortOrder: input.sortOrder ?? 0,
          parentId: input.parentId ?? null,
          variantType: input.variantType ?? null,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: this.toDTO(row, []) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create list',
      };
    }
  }

  async updateList(id: string, input: UpdateCuratedListInput): AsyncResult<CuratedListDTO> {
    try {
      const updateData: Partial<typeof curatedLists.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        if (!input.name?.trim()) return { success: false, error: 'name cannot be empty' };
        updateData.name = input.name.trim();
      }
      if (input.description !== undefined) updateData.description = input.description;
      if (input.heroName !== undefined) updateData.heroName = normalizeHeroName(input.heroName);
      if (input.className !== undefined) updateData.className = normalizeClassName(input.className);
      if (input.format !== undefined) {
        if (!input.format?.trim()) {
          return { success: false, error: 'format cannot be cleared (Classic Constructed, Silver Age, Living Legend, Blitz)' };
        }
        updateData.format = input.format.trim();
      }
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.isPublished !== undefined) updateData.isPublished = input.isPublished;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
      if (input.parentId !== undefined) updateData.parentId = input.parentId ?? null;
      if (input.variantType !== undefined) updateData.variantType = input.variantType ?? null;

      const [row] = await db
        .update(curatedLists)
        .set(updateData)
        .where(eq(curatedLists.id, id))
        .returning();

      if (!row) {
        return { success: false, error: 'Curated list not found' };
      }

      const cardList = await this.fetchCardsForList(id);
      return { success: true, data: this.toDTO(row, cardList) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update list',
      };
    }
  }

  async deleteList(id: string): AsyncResult<void> {
    try {
      await db.delete(curatedLists).where(eq(curatedLists.id, id));
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete list',
      };
    }
  }

  async addCard(listId: string, printingId: string): AsyncResult<CuratedListCardDTO> {
    try {
      const id = nanoid();
      const maxOrder = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(curatedListCards)
        .where(eq(curatedListCards.listId, listId));
      const sortOrder = (maxOrder[0]?.max ?? -1) + 1;

      await db.insert(curatedListCards).values({ id, listId, printingId, sortOrder });

      const allCards = await this.fetchCardsForList(listId);
      const card = allCards.find(c => c.id === id);
      if (!card) throw new Error('Card not found after insert');
      return { success: true, data: card };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add card',
      };
    }
  }

  async addCards(listId: string, printingIds: string[]): AsyncResult<CuratedListCardDTO[]> {
    try {
      const maxOrder = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(curatedListCards)
        .where(eq(curatedListCards.listId, listId));
      let sortOrder = (maxOrder[0]?.max ?? -1) + 1;

      const rows = printingIds.map(printingId => ({
        id: nanoid(),
        listId,
        printingId,
        sortOrder: sortOrder++,
      }));

      await db.insert(curatedListCards).values(rows);

      const allCards = await this.fetchCardsForList(listId);
      const insertedIds = new Set(rows.map(r => r.id));
      const cards = allCards.filter(c => insertedIds.has(c.id));
      return { success: true, data: cards };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add cards',
      };
    }
  }

  async removeCard(cardId: string): AsyncResult<void> {
    try {
      await db.delete(curatedListCards).where(eq(curatedListCards.id, cardId));
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove card',
      };
    }
  }

  async updateCardComment(listId: string, cardName: string, comment: string | null): AsyncResult<void> {
    try {
      // Update comment on all cards in this list that match the given card name (via JOIN)
      await db.execute(
        sql`UPDATE curated_list_cards clc
            SET comment = ${comment}
            FROM printings p
            JOIN cards c ON p.card_unique_id = c.card_unique_id
            WHERE clc.printing_id = p.printing_id
              AND clc.list_id = ${listId}
              AND lower(c.display_name) = lower(${cardName})`
      );
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update card comment',
      };
    }
  }

  async reorderCards(listId: string, cardIds: string[]): AsyncResult<void> {
    try {
      await Promise.all(
        cardIds.map((cardId, index) =>
          db
            .update(curatedListCards)
            .set({ sortOrder: index })
            .where(eq(curatedListCards.id, cardId))
        )
      );
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder cards',
      };
    }
  }
}
