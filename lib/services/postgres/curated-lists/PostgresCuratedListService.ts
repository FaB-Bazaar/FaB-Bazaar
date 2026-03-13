import { db } from '@/lib/postgres/db';
import { curatedLists, curatedListCards, printings, cards } from '@/lib/postgres/schema';
import { eq, asc, or, isNull, and, sql } from 'drizzle-orm';
import { getHeroInfo } from '@/lib/fab-constants/heroes';
import { nanoid } from 'nanoid';
import type {
  ICuratedListService,
  CuratedListDTO,
  CuratedListCardDTO,
  CreateCuratedListInput,
  UpdateCuratedListInput,
  VariantType,
} from '../../contracts/ICuratedListService';
import type { AsyncResult } from '../../contracts/common';

export class PostgresCuratedListService implements ICuratedListService {
  private toDTO(row: typeof curatedLists.$inferSelect, cardList?: CuratedListCardDTO[]): CuratedListDTO {
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      cards: cardList,
    };
  }

  private async fetchCardsForList(listId: string): Promise<CuratedListCardDTO[]> {
    const rows = await db
      .select({
        id: curatedListCards.id,
        listId: curatedListCards.listId,
        printingId: curatedListCards.printingId,
        sortOrder: curatedListCards.sortOrder,
        displayName: cards.displayName,
        imageUrl: printings.imageUrl,
        setCode: printings.set,
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
      sortOrder: row.sortOrder ?? 0,
      displayName: row.displayName ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      setCode: row.setCode ?? undefined,
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
        .select()
        .from(curatedLists)
        .where(and(heroFilter, eq(curatedLists.isPublished, true)))
        .orderBy(asc(curatedLists.sortOrder));

      const result: CuratedListDTO[] = await Promise.all(
        rows.map(async row => {
          const cardList = await this.fetchCardsForList(row.id);
          return this.toDTO(row, cardList);
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

  async getAllLists(): AsyncResult<CuratedListDTO[]> {
    try {
      const rows = await db
        .select()
        .from(curatedLists)
        .orderBy(asc(curatedLists.sortOrder));

      return { success: true, data: rows.map(row => this.toDTO(row)) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all lists',
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
      const id = nanoid();
      const now = new Date();

      const [row] = await db
        .insert(curatedLists)
        .values({
          id,
          name: input.name,
          description: input.description ?? null,
          heroName: input.heroName ?? null,
          className: input.className ?? null,
          format: input.format ?? null,
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

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.heroName !== undefined) updateData.heroName = input.heroName;
      if (input.className !== undefined) updateData.className = input.className ?? null;
      if (input.format !== undefined) updateData.format = input.format;
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
