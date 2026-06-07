/**
 * PostgreSQL implementation of Printings Service
 *
 * Implements IPrintingsService using PostgreSQL + Drizzle ORM
 * Handles full card search with 50+ filters
 */

import { eq, and, or, sql, inArray, notInArray, desc, asc, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { printings, cards, bannedCards, cardTranslations, cardFacetTags } from '@/lib/postgres/schema';
import { isFacetTag } from '@/lib/search/card-facets';
import type {
  IPrintingsService,
  PrintingDTO,
  PrintingsSearchFilters,
  PrintingsSearchOptions,
  PrintingsSearchResult,
  PrintingsFilterValues,
  PriceStatistics,
  EssenceStatistics,
  CardSummaryDTO,
  HeroPoolFilters,
  HeroLegalityFlag,
  HeroLegalityRow,
  HeroFormat,
} from '@/lib/services/contracts/IPrintingsService';
import { HERO_LEGALITY_FLAGS, HERO_FORMATS } from '@/lib/services/contracts/IPrintingsService';
import type { AsyncResult } from '@/lib/services/contracts/common';
import { HERO_CLASSES } from '@/lib/fab-constants/classes';
import { getHeroInfo } from '@/lib/fab-constants/heroes';
import { KEYWORDS } from '@/lib/fab-constants/keywords';
import { OFFICIAL_TALENTS } from '@/lib/talent-constants';

export class PostgresPrintingsService implements IPrintingsService {
  /**
   * Search printings with filters and options
   */
  async searchPrintings(
    filters: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    // Opt-in card-level grouping. Branches BEFORE the flat path so every
    // existing caller (card-search dialog, bulk, MCP) that omits the flag runs
    // the unchanged flat query and still receives every printing.
    if (options?.groupByCard) {
      return this.searchPrintingsGrouped(filters, options);
    }

    const startTime = Date.now();

    try {
      // Build where conditions
      const conditions = this.buildWhereConditions(filters, options);

      // Pagination
      const limit = options?.limit || 50;
      const page = options?.page || 1;
      const offset = (page - 1) * limit;

      // Sorting
      const orderByClause = this.buildOrderBy(options, filters.priceField, filters);

      // Execute query with JOIN
      const results = await db
        .select(this.buildSelectFields())
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .leftJoin(
          cardTranslations,
          and(
            eq(cardTranslations.cardUniqueId, cards.cardUniqueId),
            eq(cardTranslations.language, printings.language)
          )
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset);

      // Count total
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult?.count || 0;
      const pages = Math.ceil(total / limit);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          printings: results.map((row) => this.mapToPrintingDTO(row)),
          total,
          page,
          pages,
          queryInfo: {
            executionTime,
            filters,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search printings',
      };
    }
  }

  /**
   * Card-level search: one row per card_unique_id, represented by its CHEAPEST
   * printing (tcg_low ASC, priced first). Used by price-aware grouped views.
   *
   * Shape: a DISTINCT ON subquery picks the representative printing per card,
   * then the outer query applies the user's sort + pagination. The total is the
   * distinct card count. Reuses the same WHERE builder + select projection +
   * row→DTO mapping as the flat path, so a representative row is a full
   * PrintingDTO (its own printing's set/foiling/price/image).
   */
  private async searchPrintingsGrouped(
    filters: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    const startTime = Date.now();
    try {
      const conditions = this.buildWhereConditions(filters, options);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const limit = options?.limit || 50;
      const page = options?.page || 1;
      const offset = (page - 1) * limit;

      // Reuse the shared projection, but give the two `created_at` columns
      // (printings + cards) explicit SQL aliases — otherwise they collide as
      // duplicate `created_at` columns inside the subquery. JS keys are
      // unchanged, so mapToPrintingDTO still works.
      const reprFields = {
        ...this.buildSelectFields(),
        printingCreatedAt: sql`${printings.createdAt}`.as('printing_created_at'),
        cardCreatedAt: sql`${cards.createdAt}`.as('card_created_at'),
      };

      // Representative printing per card: cheapest first (NULL prices last),
      // tie-broken by printing_id for determinism. DISTINCT ON requires the
      // ORDER BY to lead with the distinct key.
      const repr = db
        .selectDistinctOn([printings.cardUniqueId], reprFields)
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .leftJoin(
          cardTranslations,
          and(
            eq(cardTranslations.cardUniqueId, cards.cardUniqueId),
            eq(cardTranslations.language, printings.language)
          )
        )
        .where(where)
        .orderBy(printings.cardUniqueId, sql`${printings.tcgLow} ASC NULLS LAST`, printings.printingId)
        .as('repr');

      // Outer: re-sort the representatives by the user's choice + paginate.
      const results = await db
        .select()
        .from(repr)
        .orderBy(...this.buildGroupedOrderBy(repr, options))
        .limit(limit)
        .offset(offset);

      // Total = distinct cards matching (not printings).
      const [countResult] = await db
        .select({ count: sql<number>`count(DISTINCT ${printings.cardUniqueId})::int` })
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(where);

      const total = countResult?.count || 0;
      const pages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          printings: results.map((row) => this.mapToPrintingDTO(row)),
          total,
          page,
          pages,
          queryInfo: { executionTime: Date.now() - startTime, filters },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search printings (grouped)',
      };
    }
  }

  /**
   * Order-by for the grouped outer query. Mirrors buildOrderBy but references
   * the DISTINCT ON subquery's columns (by select-field key) instead of the
   * base tables. Name is the secondary tiebreaker on every sort.
   */
  private buildGroupedOrderBy(repr: any, options?: PrintingsSearchOptions): any[] {
    const sortBy = options?.sortBy || 'name';
    const orderFn = options?.sortOrder === 'desc' ? desc : asc;
    switch (sortBy) {
      // The representative IS the cheapest printing, so sorting by its tcg_low
      // sorts cards by cheapest available price.
      case 'price':   return [orderFn(repr.tcgLow), asc(repr.name)];
      case 'power':   return [orderFn(repr.power), asc(repr.name)];
      case 'cost':    return [orderFn(repr.cost), asc(repr.name)];
      case 'defense': return [orderFn(repr.defense), asc(repr.name)];
      case 'set':     return [orderFn(repr.set), asc(repr.name)];
      case 'rarity':  return [orderFn(repr.rarity), asc(repr.name)];
      case 'collector_number': return [orderFn(repr.collectorNumber), asc(repr.name)];
      case 'name':
      default:        return [orderFn(repr.name)];
    }
  }

  /**
   * Curated facet tags for a card (reads the projected cards.facet_tags column).
   */
  async getCardFacetTags(cardUniqueId: string): AsyncResult<string[]> {
    try {
      const [row] = await db
        .select({ ft: cards.facetTags })
        .from(cards)
        .where(eq(cards.cardUniqueId, cardUniqueId))
        .limit(1);
      return { success: true, data: row ? [...row.ft].sort() : [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to read facet tags' };
    }
  }

  /**
   * Replace a card's curated facet tags. Validates against the card-facets
   * vocabulary, applies to ALL card_unique_ids sharing the display_name (facets
   * are intrinsic to the card's function, identical across pitch variants), and
   * projects into cards.facet_tags for fast search.
   */
  async setCardFacetTags(cardUniqueId: string, tags: string[]): AsyncResult<{ applied: number }> {
    try {
      const invalid = tags.filter((t) => !isFacetTag(t));
      if (invalid.length > 0) {
        return { success: false, error: `Invalid facet tags: ${invalid.join(', ')}` };
      }
      const unique = [...new Set(tags)];

      const [card] = await db
        .select({ name: cards.displayName })
        .from(cards)
        .where(eq(cards.cardUniqueId, cardUniqueId))
        .limit(1);
      if (!card) return { success: false, error: 'Card not found' };

      const variants = await db
        .select({ id: cards.cardUniqueId })
        .from(cards)
        .where(eq(cards.displayName, card.name));

      for (const { id } of variants) {
        await db.delete(cardFacetTags).where(eq(cardFacetTags.cardUniqueId, id));
        if (unique.length > 0) {
          await db.insert(cardFacetTags).values(unique.map((tag) => ({ cardUniqueId: id, tag })));
        }
        await db.update(cards).set({ facetTags: unique }).where(eq(cards.cardUniqueId, id));
      }

      return { success: true, data: { applied: variants.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set facet tags' };
    }
  }

  /**
   * Resolve multiple cards by name+pitch in a single DB query.
   * One round-trip regardless of how many cards are passed.
   */
  async bulkResolveByName(
    inputCards: Array<{ name: string; pitch?: number }>,
    sharedFilters?: Pick<PrintingsSearchFilters, 'heroClasses' | 'heroTalents' | 'heroEssences' | 'format'>
  ): AsyncResult<Array<{ name: string; pitch?: number; printings: PrintingDTO[] }>> {
    try {
      if (inputCards.length === 0) {
        return { success: true, data: [] };
      }

      // Normalize names and build per-entry conditions
      const normalized = inputCards.map(c => ({
        ...c,
        normalizedName: c.name
          .replace(/[\u2018\u2019\u0027\u0060]/g, "'")
          .toLowerCase()
          .trim(),
      }));

      // Per-card OR clause: (name = 'a' AND pitch = 1) OR (name = 'b' AND pitch = 2) OR ...
      const rowConditions = normalized.map(c => {
        const nameCond = eq(cards.name, c.normalizedName);
        if (c.pitch === undefined || c.pitch === 0) {
          return nameCond;
        }
        return and(nameCond, eq(cards.pitch, c.pitch))!;
      });

      // Shared AND constraints (hero legality, format legality)
      const sharedConditions = sharedFilters
        ? this.buildWhereConditions(sharedFilters)
        : [];

      // Final: AND(shared..., OR(perCard...))
      const whereClause = sharedConditions.length > 0
        ? and(...sharedConditions, or(...rowConditions))
        : or(...rowConditions);

      const results = await db
        .select(this.buildSelectFields())
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .leftJoin(
          cardTranslations,
          and(
            eq(cardTranslations.cardUniqueId, cards.cardUniqueId),
            eq(cardTranslations.language, printings.language)
          )
        )
        .where(whereClause)
        .orderBy(...this.buildOrderBy(undefined, undefined, {}));

      const dtos = results.map(row => this.mapToPrintingDTO(row));

      // Group results back to each input entry
      return {
        success: true,
        data: normalized.map(c => ({
          name: c.name,
          pitch: c.pitch,
          printings: dtos.filter(p => {
            const nameMatch = (p.name ?? '').toLowerCase() === c.normalizedName;
            if (c.pitch === undefined || c.pitch === 0) return nameMatch;
            return nameMatch && p.pitch === c.pitch;
          }),
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk resolve cards',
      };
    }
  }

  /**
   * Get single printing by printing_id
   */
  async getPrintingById(printingId: string): AsyncResult<PrintingDTO | null> {
    try {
      const results = await db
        .select(this.buildSelectFields())
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .leftJoin(
          cardTranslations,
          and(
            eq(cardTranslations.cardUniqueId, cards.cardUniqueId),
            eq(cardTranslations.language, printings.language)
          )
        )
        .where(eq(printings.printingId, printingId))
        .limit(1);

      if (!results || results.length === 0) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.mapToPrintingDTO(results[0]),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get printing by ID',
      };
    }
  }

  /**
   * Get all printings for a specific card
   */
  async getPrintingsForCard(
    cardId: string,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    // Try as cardUniqueId first, then as name
    let result = await this.searchPrintings({ cardUniqueId: cardId }, options);

    if (result.success && result.data.total === 0) {
      // Try by name
      result = await this.searchPrintings({ name: cardId, exact: true }, options);
    }

    return result;
  }

  /**
   * Get multiple printings by their printing_id values
   */
  async getPrintingsByIds(
    printingIds: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    if (printingIds.length === 0) {
      return {
        success: true,
        data: {
          printings: [],
          total: 0,
          page: 1,
          pages: 0,
          queryInfo: { executionTime: 0, filters: { printingIds } },
        },
      };
    }

    return this.searchPrintings({ printingIds }, options);
  }

  /**
   * Get printings legal for a specific hero
   */
  async getPrintingsForHero(
    heroName: string,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    return this.searchPrintings({ heroLegal: heroName }, options);
  }

  /**
   * Fetch the hero's full card pool as slim card-level summaries.
   * One row per unique card; representative printing chosen by foiling priority.
   */
  async searchCardsForHero(filters: HeroPoolFilters): AsyncResult<CardSummaryDTO[]> {
    try {
      // Reuse the existing hero/format condition builder for parity with searchPrintings
      const conditions = this.buildWhereConditions({
        heroClasses: filters.heroClasses,
        heroTalents: filters.heroTalents,
        heroEssences: filters.heroEssences,
        format: filters.format as PrintingsSearchFilters['format'],
      });
      const whereClause = conditions.length > 0 ? and(...conditions) : sql`TRUE`;

      // DISTINCT ON picks one printing per card via foiling priority (matches
      // FOIL_PRIORITY in lib/fab-constants/sets.ts:415: standard → rainbow → cold → others → gold).
      // printings_count is a correlated subselect for the TOTAL printings of each
      // card (unfiltered) — UI uses this to show "12 printings" regardless of legality.
      const result = await db.execute(sql`
        SELECT DISTINCT ON (${cards.cardUniqueId})
          ${cards.cardUniqueId} AS card_unique_id,
          ${cards.name} AS name,
          ${cards.types} AS types,
          ${cards.pitch} AS pitch,
          ${cards.cost} AS cost,
          ${cards.defense} AS defense,
          ${cards.power} AS power,
          ${cards.keywords} AS keywords,
          ${cards.classes} AS classes,
          ${cards.talents} AS talents,
          ${cards.color} AS color,
          ${printings.printingId} AS representative_printing_id,
          ${printings.imageUrl} AS representative_image_url,
          (SELECT COUNT(*) FROM ${printings} p2 WHERE p2.card_unique_id = ${cards.cardUniqueId}) AS printings_count
        FROM ${cards}
        INNER JOIN ${printings} ON ${printings.cardUniqueId} = ${cards.cardUniqueId}
        WHERE ${whereClause}
        ORDER BY
          ${cards.cardUniqueId},
          CASE ${printings.foiling}
            WHEN 's' THEN 0
            WHEN 'n' THEN 0
            WHEN 'r' THEN 1
            WHEN 'c' THEN 2
            WHEN 'g' THEN 4
            ELSE 3
          END,
          ${printings.printingId}
      `);

      const data: CardSummaryDTO[] = (result.rows as Record<string, unknown>[]).map((r) => ({
        cardUniqueId: r.card_unique_id as string,
        name: r.name as string,
        types: (r.types as string[] | null) ?? [],
        pitch: (r.pitch as number | null) ?? null,
        cost: (r.cost as number | null) ?? null,
        defense: (r.defense as number | null) ?? null,
        power: (r.power as number | null) ?? null,
        keywords: (r.keywords as string[] | null) ?? [],
        classes: (r.classes as string[] | null) ?? [],
        talents: (r.talents as string[] | null) ?? [],
        color: (r.color as string | null) ?? '',
        representativePrintingId: r.representative_printing_id as string,
        representativeImageUrl: (r.representative_image_url as string | null) ?? null,
        printingsCount: Number(r.printings_count) || 1,
      }));

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search cards for hero',
      };
    }
  }

  /**
   * Resolve a set of card_unique_ids to one representative printing each.
   * Mirrors searchCardsForHero's DISTINCT ON + foiling-priority selection but
   * filters by an explicit id set instead of hero/format. Returns exactly one
   * row per known card (no printing duplicates, no truncation); unknown ids are
   * dropped. Empty input short-circuits without a DB round trip.
   */
  async getCardSummariesByUniqueIds(cardUniqueIds: string[]): AsyncResult<CardSummaryDTO[]> {
    try {
      if (cardUniqueIds.length === 0) {
        return { success: true, data: [] };
      }

      // DISTINCT ON picks one printing per card via foiling priority (matches
      // FOIL_PRIORITY in lib/fab-constants/sets.ts:415: standard → rainbow → cold → others → gold).
      // printings_count is a correlated subselect for the TOTAL printings of each card.
      const result = await db.execute(sql`
        SELECT DISTINCT ON (${cards.cardUniqueId})
          ${cards.cardUniqueId} AS card_unique_id,
          ${cards.name} AS name,
          ${cards.types} AS types,
          ${cards.pitch} AS pitch,
          ${cards.cost} AS cost,
          ${cards.defense} AS defense,
          ${cards.power} AS power,
          ${cards.keywords} AS keywords,
          ${cards.classes} AS classes,
          ${cards.talents} AS talents,
          ${cards.color} AS color,
          ${printings.printingId} AS representative_printing_id,
          ${printings.imageUrl} AS representative_image_url,
          (SELECT COUNT(*) FROM ${printings} p2 WHERE p2.card_unique_id = ${cards.cardUniqueId}) AS printings_count
        FROM ${cards}
        INNER JOIN ${printings} ON ${printings.cardUniqueId} = ${cards.cardUniqueId}
        WHERE ${inArray(cards.cardUniqueId, cardUniqueIds)}
        ORDER BY
          ${cards.cardUniqueId},
          CASE ${printings.foiling}
            WHEN 's' THEN 0
            WHEN 'n' THEN 0
            WHEN 'r' THEN 1
            WHEN 'c' THEN 2
            WHEN 'g' THEN 4
            ELSE 3
          END,
          ${printings.printingId}
      `);

      const data: CardSummaryDTO[] = (result.rows as Record<string, unknown>[]).map((r) => ({
        cardUniqueId: r.card_unique_id as string,
        name: r.name as string,
        types: (r.types as string[] | null) ?? [],
        pitch: (r.pitch as number | null) ?? null,
        cost: (r.cost as number | null) ?? null,
        defense: (r.defense as number | null) ?? null,
        power: (r.power as number | null) ?? null,
        keywords: (r.keywords as string[] | null) ?? [],
        classes: (r.classes as string[] | null) ?? [],
        talents: (r.talents as string[] | null) ?? [],
        color: (r.color as string | null) ?? '',
        representativePrintingId: r.representative_printing_id as string,
        representativeImageUrl: (r.representative_image_url as string | null) ?? null,
        printingsCount: Number(r.printings_count) || 1,
      }));

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve card summaries',
      };
    }
  }

  /**
   * Get elemental cards by essence type(s)
   */
  async getElementalCards(
    essenceTypes: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    return this.searchPrintings({ talents: essenceTypes }, options);
  }

  /**
   * Get cards by class and/or talent combination
   */
  async getCardsByClassTalent(
    classes?: string[],
    talents?: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    return this.searchPrintings({ classes, talents }, options);
  }

  /**
   * Get available filter values for faceted search
   */
  async getFilterValues(): AsyncResult<PrintingsFilterValues> {
    try {
      const [sets, editions, foilings, rarities, types, traits, keywords, colors, classesData, talentsData] =
        await Promise.all([
          db.selectDistinct({ value: printings.set }).from(printings).orderBy(asc(printings.set)),
          db.selectDistinct({ value: printings.edition }).from(printings).orderBy(asc(printings.edition)),
          db.selectDistinct({ value: printings.foiling }).from(printings).orderBy(asc(printings.foiling)),
          db.selectDistinct({ value: printings.rarity }).from(printings).orderBy(asc(printings.rarity)),
          db.select({ value: sql<string>`unnest(${cards.types})` }).from(cards).groupBy(sql`unnest(${cards.types})`),
          db.select({ value: sql<string>`unnest(${cards.traits})` }).from(cards).groupBy(sql`unnest(${cards.traits})`),
          db.select({ value: sql<string>`unnest(${cards.keywords})` }).from(cards).groupBy(sql`unnest(${cards.keywords})`),
          db.selectDistinct({ value: cards.color }).from(cards).where(sql`${cards.color} != ''`).orderBy(asc(cards.color)),
          db.select({ value: sql<string>`unnest(${cards.classes})` }).from(cards).groupBy(sql`unnest(${cards.classes})`),
          db.select({ value: sql<string>`unnest(${cards.talents})` }).from(cards).groupBy(sql`unnest(${cards.talents})`),
        ]);

      // Get artists from printings (array field)
      const artistsData = await db
        .select({ value: sql<string>`unnest(${printings.artists})` })
        .from(printings)
        .groupBy(sql`unnest(${printings.artists})`);

      return {
        success: true,
        data: {
          sets: sets.map((row) => row.value),
          editions: editions.map((row) => row.value),
          foilings: foilings.map((row) => row.value),
          rarities: rarities.map((row) => row.value),
          artists: artistsData.map((row) => row.value),
          types: types.map((row) => row.value),
          traits: traits.map((row) => row.value),
          keywords: keywords.map((row) => row.value),
          colors: colors.map((row) => row.value),
          classes: classesData.map((row) => row.value),
          talents: talentsData.map((row) => row.value),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get filter values',
      };
    }
  }

  /**
   * Get essence statistics
   */
  async getEssenceStatistics(): AsyncResult<EssenceStatistics> {
    try {
      const [earthCount, iceCount, lightningCount, lightCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(cards).where(eq(cards.hasEarth, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(cards).where(eq(cards.hasIce, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(cards).where(eq(cards.hasLightning, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(cards).where(eq(cards.hasLight, true)),
      ]);

      // Combinations
      const [earthIce, earthLightning, iceLightning, earthLight, iceLight, lightningLight] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cards)
          .where(and(eq(cards.hasEarth, true), eq(cards.hasIce, true))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cards)
          .where(and(eq(cards.hasEarth, true), eq(cards.hasLightning, true))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cards)
          .where(and(eq(cards.hasIce, true), eq(cards.hasLightning, true))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cards)
          .where(and(eq(cards.hasEarth, true), eq(cards.hasLight, true))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cards)
          .where(and(eq(cards.hasIce, true), eq(cards.hasLight, true))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cards)
          .where(and(eq(cards.hasLightning, true), eq(cards.hasLight, true))),
      ]);

      return {
        success: true,
        data: {
          earth: earthCount[0]?.count || 0,
          ice: iceCount[0]?.count || 0,
          lightning: lightningCount[0]?.count || 0,
          light: lightCount[0]?.count || 0,
          combinations: {
            earth_ice: earthIce[0]?.count || 0,
            earth_lightning: earthLightning[0]?.count || 0,
            ice_lightning: iceLightning[0]?.count || 0,
            earth_light: earthLight[0]?.count || 0,
            ice_light: iceLight[0]?.count || 0,
            lightning_light: lightningLight[0]?.count || 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get essence statistics',
      };
    }
  }

  /**
   * Get price statistics for filtered cards
   */
  async getPriceStatistics(
    filters?: PrintingsSearchFilters
  ): AsyncResult<PriceStatistics> {
    try {
      const conditions = this.buildWhereConditions(filters || {});

      const results = await db
        .select({
          count: sql<number>`count(*)::int`,
          avgPrice: sql<number>`avg(${printings.tcgMarket})::real`,
          minPrice: sql<number>`min(${printings.tcgMarket})::real`,
          maxPrice: sql<number>`max(${printings.tcgMarket})::real`,
          totalValue: sql<number>`sum(${printings.tcgMarket})::real`,
          budget: sql<number>`count(*) FILTER (WHERE ${printings.isBudget})::int`,
          under5: sql<number>`count(*) FILTER (WHERE ${printings.isUnder5})::int`,
          under10: sql<number>`count(*) FILTER (WHERE ${printings.isUnder10})::int`,
          under25: sql<number>`count(*) FILTER (WHERE ${printings.isUnder25})::int`,
          under50: sql<number>`count(*) FILTER (WHERE ${printings.isUnder50})::int`,
          under100: sql<number>`count(*) FILTER (WHERE ${printings.isUnder100})::int`,
          expensive: sql<number>`count(*) FILTER (WHERE ${printings.isExpensive})::int`,
        })
        .from(printings)
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const stats = results[0];

      return {
        success: true,
        data: {
          count: stats?.count || 0,
          avgPrice: stats?.avgPrice || 0,
          minPrice: stats?.minPrice || 0,
          maxPrice: stats?.maxPrice || 0,
          totalValue: stats?.totalValue || 0,
          priceRanges: {
            budget: stats?.budget || 0,
            under5: stats?.under5 || 0,
            under10: stats?.under10 || 0,
            under25: stats?.under25 || 0,
            under50: stats?.under50 || 0,
            under100: stats?.under100 || 0,
            expensive: stats?.expensive || 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get price statistics',
      };
    }
  }

  /**
   * Get deck building cards for a hero
   */
  async getDeckBuildingCards(
    heroName: string,
    additionalFilters?: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    // Combine hero filter with additional filters, exclude heroes
    const filters: PrintingsSearchFilters = {
      ...additionalFilters,
      heroLegal: heroName,
      isHero: false, // Exclude hero cards
    };

    return this.searchPrintings(filters, options);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Build SELECT fields for printing queries
   */
  private buildSelectFields() {
    return {
      // Printing fields
      printingId: printings.printingId,
      cardUniqueId: printings.cardUniqueId,
      setPrintingUniqueId: printings.setPrintingUniqueId,
      collectorNumber: printings.collectorNumber,
      set: printings.set,
      edition: printings.edition,
      foiling: printings.foiling,
      rarity: printings.rarity,
      language: printings.language,
      artists: printings.artists,
      artVariations: printings.artVariations,
      flavorText: printings.flavorText,
      imageUrl: printings.imageUrl,
      tcgplayerProductId: printings.tcgplayerProductId,
      tcgplayerUrl: printings.tcgplayerUrl,
      tcgLow: printings.tcgLow,
      tcgMid: printings.tcgMid,
      tcgHigh: printings.tcgHigh,
      tcgMarket: printings.tcgMarket,
      priceUpdatedAt: printings.priceUpdatedAt,
      // Printing boolean flags
      isFirstEdition: printings.isFirstEdition,
      isUnlimited: printings.isUnlimited,
      isNormalEdition: printings.isNormalEdition,
      isNormalFoil: printings.isNormalFoil,
      isRainbowFoil: printings.isRainbowFoil,
      isColdFoil: printings.isColdFoil,
      isExtendedArt: printings.isExtendedArt,
      foilInsetTop: printings.foilInsetTop,
      foilInsetRight: printings.foilInsetRight,
      foilInsetBottom: printings.foilInsetBottom,
      foilInsetLeft: printings.foilInsetLeft,
      foilInsetRound: printings.foilInsetRound,
      isCommon: printings.isCommon,
      isRare: printings.isRare,
      isSuperRare: printings.isSuperRare,
      isMajestic: printings.isMajestic,
      isLegendary: printings.isLegendary,
      isFabled: printings.isFabled,
      isPromo: printings.isPromo,
      isBudget: printings.isBudget,
      isUnder5: printings.isUnder5,
      isUnder10: printings.isUnder10,
      isUnder25: printings.isUnder25,
      isUnder50: printings.isUnder50,
      isUnder100: printings.isUnder100,
      isExpensive: printings.isExpensive,
      isPremium: printings.isPremium,
      expansionSlot: printings.expansionSlot,
      printingCreatedAt: printings.createdAt,
      // Card fields via JOIN
      name: cards.name,
      displayName: cards.displayName,
      // Rendered rules text from card_translations (matches printings.language).
      // cards.text is the lowercased searchable copy; falls back only when no
      // translation row exists for the printing's language.
      text: sql<string | null>`COALESCE(${cardTranslations.text}, ${cards.text})`.as('text'),
      searchableText: cards.searchableText,
      typeText: cards.typeText,
      typeTextDisplay: cards.typeTextDisplay,
      types: cards.types,
      traits: cards.traits,
      keywords: cards.keywords,
      keywordsDisplay: cards.keywordsDisplay,
      abilities: cards.abilities,
      classes: cards.classes,
      talents: cards.talents,
      power: cards.power,
      powerText: cards.powerText,
      cost: cards.cost,
      costText: cards.costText,
      defense: cards.defense,
      defenseText: cards.defenseText,
      pitch: cards.pitch,
      pitchText: cards.pitchText,
      health: cards.health,
      intelligence: cards.intelligence,
      color: cards.color,
      // Card boolean flags
      isAction: cards.isAction,
      isAttack: cards.isAttack,
      isDefenseReaction: cards.isDefenseReaction,
      isInstant: cards.isInstant,
      isEquipment: cards.isEquipment,
      isWeapon: cards.isWeapon,
      isHero: cards.isHero,
      isMentor: cards.isMentor,
      isToken: cards.isToken,
      playedHorizontally: cards.playedHorizontally,
      isGeneric: cards.isGeneric,
      isBrute: cards.isBrute,
      isGuardian: cards.isGuardian,
      isMechanologist: cards.isMechanologist,
      isRanger: cards.isRanger,
      isRuneblade: cards.isRuneblade,
      isAssassin: cards.isAssassin,
      isWarrior: cards.isWarrior,
      isNinja: cards.isNinja,
      isWizard: cards.isWizard,
      isMerchant: cards.isMerchant,
      isBard: cards.isBard,
      isAdjudicator: cards.isAdjudicator,
      isIllusionist: cards.isIllusionist,
      isThief: cards.isThief,
      isShapeshifter: cards.isShapeshifter,
      isNecromancer: cards.isNecromancer,
      hasChaos: cards.hasChaos,
      hasLight: cards.hasLight,
      hasRoyal: cards.hasRoyal,
      hasDraconic: cards.hasDraconic,
      hasLightning: cards.hasLightning,
      hasShadow: cards.hasShadow,
      hasEarth: cards.hasEarth,
      hasMystic: cards.hasMystic,
      hasRevered: cards.hasRevered,
      hasIce: cards.hasIce,
      hasReviled: cards.hasReviled,
      hasPirate: cards.hasPirate,
      hasElemental: cards.hasElemental,
      isGenericOnly: cards.isGenericOnly,
      hasClassAndTalent: cards.hasClassAndTalent,
      hasClassOnly: cards.hasClassOnly,
      hasTalentOnly: cards.hasTalentOnly,
      blitzLegal: cards.blitzLegal,
      ccLegal: cards.ccLegal,
      commonerLegal: cards.commonerLegal,
      llLegal: cards.llLegal,
      silverAgeLegal: cards.silverAgeLegal,
      blitzBanned: cards.blitzBanned,
      ccBanned: cards.ccBanned,
      commonerBanned: cards.commonerBanned,
      llBanned: cards.llBanned,
      silverAgeBanned: cards.silverAgeBanned,
      blitzSuspended: cards.blitzSuspended,
      ccSuspended: cards.ccSuspended,
      commonerSuspended: cards.commonerSuspended,
      llRestricted: cards.llRestricted,
      silverAgeSuspended: cards.silverAgeSuspended,
      cardCreatedAt: cards.createdAt,
    };
  }

  /**
   * Build WHERE conditions from filters
   * Implements 50+ filter options
   */
  private buildWhereConditions(
    filters: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): any[] {
    const conditions: any[] = [];
    const lc = (arr: readonly string[]): string[] =>
      arr.map(s => (typeof s === 'string' ? s.toLowerCase() : s));

    // ===== IDENTIFIERS =====
    if (filters.cardUniqueId) {
      conditions.push(eq(cards.cardUniqueId, filters.cardUniqueId));
    }

    if (filters.cardUniqueIds && filters.cardUniqueIds.length > 0) {
      conditions.push(inArray(cards.cardUniqueId, filters.cardUniqueIds));
    }

    if (filters.printingIds && filters.printingIds.length > 0) {
      conditions.push(inArray(printings.printingId, filters.printingIds));
    }

    if (filters.collectorNumber) {
      if (Array.isArray(filters.collectorNumber)) {
        conditions.push(inArray(printings.collectorNumber, filters.collectorNumber));
      } else {
        conditions.push(eq(printings.collectorNumber, filters.collectorNumber));
      }
    }

    // ===== TEXT SEARCHES =====
    if (filters.name) {
      const normalizedName = filters.name
        .replace(/[\u2018\u2019\u0027\u0060]/g, "'")
        .toLowerCase()
        .trim();

      if (filters.exact) {
        conditions.push(eq(cards.name, normalizedName));
      } else if (options?.searchMode === 'strict') {
        // Strict mode: whole-phrase substring match only, no word splitting, no fuzzy matching.
        // Prevents "mangle" from matching "Entangle", "widow claw" matches "Widow Claw Tarsus" as a phrase.
        const phraseCondition = sql`${cards.name} ILIKE ${'%' + normalizedName + '%'}`;
        if (/^[a-zA-Z0-9]{2,5}\d{2,4}$/.test(normalizedName)) {
          conditions.push(or(phraseCondition, sql`LOWER(${printings.collectorNumber}) = ${normalizedName}`));
        } else {
          conditions.push(phraseCondition);
        }
      } else {
        // Broad mode (default): typo-tolerant name matching against cards.name only.
        // 1. ILIKE per term handles out-of-order words (e.g. "skeleta bloodsheath")
        // 2. word_similarity handles typos (e.g. "bloodsheat" → "bloodsheath")
        // cards.name is stored lowercased and has a gin_trgm index, so ILIKE on the
        // lowercased query hits the index. Rule text and displayName are not searched
        // here — use filters.text or filters.searchableText for rule-text search.
        const terms = normalizedName.split(/\s+/).filter(t => t.length > 0 && t !== '//');
        const termConditions = terms.map(term => sql`${cards.name} ILIKE ${`%${term}%`}`);

        const nameSearch = or(
          and(...termConditions),
          sql`word_similarity(${normalizedName}, ${cards.name}) > 0.4`
        );

        // Collector number support: if the query looks like a collector number (e.g., arc123, wtr333, her001),
        // also match against printings.collectorNumber (stored as uppercase, e.g., ARC123)
        if (/^[a-zA-Z0-9]{2,5}\d{2,4}$/.test(normalizedName)) {
          conditions.push(or(nameSearch, sql`LOWER(${printings.collectorNumber}) = ${normalizedName}`));
        } else {
          conditions.push(nameSearch);
        }
      }
    }

    if (filters.text) {
      conditions.push(sql`${cards.text} ILIKE ${`%${filters.text}%`}`);
    }

    if (filters.searchableText) {
      const normalizedQuery = filters.searchableText
        .replace(/[\u2018\u2019\u0027\u0060]/g, "'")
        .toLowerCase()
        .trim();

      // Known FaB word dictionaries (from fab-constants)
      const knownClasses = HERO_CLASSES as readonly string[];
      const knownTalents = OFFICIAL_TALENTS as readonly string[];
      const knownKeywords = KEYWORDS as readonly string[];

      // Filter out "//" — it's a split-card name separator, not a search token
      const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0 && t !== '//');

      const termConditions = terms.map(term => {
        // Base: the word must appear in name, displayName, rule text, or searchable text
        const overlapConditions: any[] = [
          sql`${cards.searchableText} ILIKE ${`%${term}%`}`,
          sql`${cards.name} ILIKE ${`%${term}%`}`,
          sql`${cards.displayName} ILIKE ${`%${term}%`}`,
          sql`${cards.text} ILIKE ${`%${term}%`}`,
        ];

        // Smart overlap: if it's a known class/talent/keyword, also check typed arrays
        // This solves the "Bash Brute" problem - "brute" in card name vs brute class
        if (knownClasses.includes(term)) {
          overlapConditions.push(sql`${cards.classes} && ARRAY[${term}]::text[]`);
        }
        if (knownTalents.includes(term)) {
          overlapConditions.push(sql`${cards.talents} && ARRAY[${term}]::text[]`);
        }
        if (knownKeywords.includes(term)) {
          overlapConditions.push(sql`${cards.keywords} && ARRAY[${term}]::text[]`);
        }

        // Collector number support: e.g., arc123, wtr333, her001
        if (/^[a-zA-Z0-9]{2,5}\d{2,4}$/.test(term)) {
          overlapConditions.push(sql`LOWER(${printings.collectorNumber}) = ${term}`);
        }

        return or(...overlapConditions);
      });

      // Card must satisfy ALL typed words (AND logic), with a word_similarity fallback
      // so single-character typos mid-word (e.g. "graves" → "greaves") still find results.
      const strictMatch = and(...termConditions);
      const fuzzyMatch = sql`word_similarity(${normalizedQuery}, ${cards.name}) > 0.4`;
      conditions.push(or(strictMatch, fuzzyMatch));
    }

    // ===== ARRAYS (types, traits, keywords, classes, talents) =====
    // Use ARRAY[...] construction with explicit ::text[] cast to avoid pg type inference issues
    if (filters.types && filters.types.length > 0) {
      conditions.push(sql`${cards.types} && ARRAY[${sql.join(lc(filters.types).map(t => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.traits && filters.traits.length > 0) {
      conditions.push(sql`${cards.traits} && ARRAY[${sql.join(filters.traits.map(t => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.keywords && filters.keywords.length > 0) {
      conditions.push(sql`${cards.keywords} && ARRAY[${sql.join(lc(filters.keywords).map(t => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.classes && filters.classes.length > 0) {
      conditions.push(sql`${cards.classes} && ARRAY[${sql.join(lc(filters.classes).map(t => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.classesNot && filters.classesNot.length > 0) {
      conditions.push(sql`NOT (${cards.classes} && ARRAY[${sql.join(lc(filters.classesNot).map(t => sql`${t}`), sql`, `)}]::text[])`);
    }

    if (filters.talents && filters.talents.length > 0) {
      conditions.push(sql`${cards.talents} && ARRAY[${sql.join(lc(filters.talents).map(t => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.talentsAll && filters.talentsAll.length > 0) {
      // All talents must be present (contains operator @>)
      conditions.push(sql`${cards.talents} @> ARRAY[${sql.join(lc(filters.talentsAll).map(t => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.talentsNot && filters.talentsNot.length > 0) {
      // Exclude cards with these talents
      conditions.push(sql`NOT (${cards.talents} && ARRAY[${sql.join(lc(filters.talentsNot).map(t => sql`${t}`), sql`, `)}]::text[])`);
    }

    if (filters.color) {
      conditions.push(eq(cards.color, filters.color.toLowerCase()));
    }

    if (filters.colors && filters.colors.length > 0) {
      conditions.push(inArray(cards.color, lc(filters.colors)));
    }

    // ===== STATS =====
    if (filters.power !== undefined) {
      if (Array.isArray(filters.power)) {
        conditions.push(inArray(cards.power, filters.power));
      } else if (filters.power === null) {
        conditions.push(sql`${cards.power} IS NULL`);
      } else {
        conditions.push(eq(cards.power, filters.power));
      }
    }

    if (filters.powerMin !== undefined) {
      conditions.push(gte(cards.power, filters.powerMin));
    }

    if (filters.powerMax !== undefined) {
      conditions.push(lte(cards.power, filters.powerMax));
    }

    if (filters.powerNot && filters.powerNot.length > 0) {
      conditions.push(sql`${cards.power} IS NULL OR NOT ${cards.power} = ANY(${filters.powerNot})`);
    }

    if (filters.cost !== undefined) {
      if (Array.isArray(filters.cost)) {
        conditions.push(inArray(cards.cost, filters.cost));
      } else if (filters.cost === null) {
        conditions.push(sql`${cards.cost} IS NULL`);
      } else {
        conditions.push(eq(cards.cost, filters.cost));
      }
    }

    if (filters.costs && filters.costs.length > 0) {
      conditions.push(inArray(cards.cost, filters.costs));
    }

    if (filters.costMin !== undefined) {
      conditions.push(gte(cards.cost, filters.costMin));
    }

    if (filters.costMax !== undefined) {
      conditions.push(lte(cards.cost, filters.costMax));
    }

    if (filters.costNot && filters.costNot.length > 0) {
      conditions.push(sql`${cards.cost} IS NULL OR NOT ${cards.cost} = ANY(${filters.costNot})`);
    }

    if (filters.defense !== undefined) {
      if (Array.isArray(filters.defense)) {
        conditions.push(inArray(cards.defense, filters.defense));
      } else if (filters.defense === null) {
        conditions.push(sql`${cards.defense} IS NULL`);
      } else {
        conditions.push(eq(cards.defense, filters.defense));
      }
    }

    if (filters.defenseMin !== undefined) {
      conditions.push(gte(cards.defense, filters.defenseMin));
    }

    if (filters.defenseMax !== undefined) {
      conditions.push(lte(cards.defense, filters.defenseMax));
    }

    if (filters.defenseNot && filters.defenseNot.length > 0) {
      conditions.push(sql`${cards.defense} IS NULL OR NOT ${cards.defense} = ANY(${filters.defenseNot})`);
    }

    if (filters.pitch !== undefined) {
      if (Array.isArray(filters.pitch)) {
        conditions.push(inArray(cards.pitch, filters.pitch));
      } else if (filters.pitch === null) {
        conditions.push(sql`${cards.pitch} IS NULL`);
      } else {
        conditions.push(eq(cards.pitch, filters.pitch));
      }
    }

    // ===== PRINTING ATTRIBUTES =====
    if (filters.sets && filters.sets.length > 0) {
      conditions.push(inArray(printings.set, filters.sets.map((s) => s.toLowerCase())));
    }

    if (filters.editions && filters.editions.length > 0) {
      conditions.push(inArray(printings.edition, filters.editions.map((e) => e.toLowerCase())));
    }

    if (filters.foilings && filters.foilings.length > 0) {
      conditions.push(inArray(printings.foiling, filters.foilings.map((f) => f.toLowerCase())));
    }

    if (filters.rarities && filters.rarities.length > 0) {
      conditions.push(inArray(printings.rarity, filters.rarities.map((r) => r.toLowerCase())));
    }

    if (filters.languages && filters.languages.length > 0) {
      conditions.push(inArray(printings.language, filters.languages.map((l) => l.toLowerCase())));
    }

    if (filters.facetTags && filters.facetTags.length > 0) {
      conditions.push(sql`${cards.facetTags} && ARRAY[${sql.join(filters.facetTags.map((t) => sql`${t}`), sql`, `)}]::text[]`);
    }

    if (filters.artists && filters.artists.length > 0) {
      conditions.push(sql`${printings.artists} && ${filters.artists}`);
    }

    // ===== PRICE FILTERS =====
    const priceField = {
      tcg_low: printings.tcgLow,
      tcg_mid: printings.tcgMid,
      tcg_high: printings.tcgHigh,
      tcg_market: printings.tcgMarket,
    }[filters.priceField || 'tcg_market'];

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      conditions.push(sql`${priceField} IS NOT NULL AND ${priceField} > 0`);

      if (filters.priceMin !== undefined) {
        conditions.push(sql`${priceField} >= ${filters.priceMin}`);
      }

      if (filters.priceMax !== undefined) {
        conditions.push(sql`${priceField} <= ${filters.priceMax}`);
      }
    }

    if (filters.hasPricing !== undefined) {
      conditions.push(eq(printings.hasPrice, filters.hasPricing));
    }

    if (filters.hasProductId !== undefined) {
      if (filters.hasProductId) {
        conditions.push(sql`${printings.tcgplayerProductId} IS NOT NULL`);
      } else {
        conditions.push(sql`${printings.tcgplayerProductId} IS NULL`);
      }
    }

    // ===== BOOLEAN FLAGS - TYPE =====
    if (filters.isAction !== undefined) conditions.push(eq(cards.isAction, filters.isAction));
    if (filters.isAttack !== undefined) conditions.push(eq(cards.isAttack, filters.isAttack));
    if (filters.isDefenseReaction !== undefined)
      conditions.push(eq(cards.isDefenseReaction, filters.isDefenseReaction));
    if (filters.isInstant !== undefined) conditions.push(eq(cards.isInstant, filters.isInstant));
    if (filters.isEquipment !== undefined) conditions.push(eq(cards.isEquipment, filters.isEquipment));
    if (filters.isWeapon !== undefined) conditions.push(eq(cards.isWeapon, filters.isWeapon));
    if (filters.isHero !== undefined) conditions.push(eq(cards.isHero, filters.isHero));
    if (filters.isMentor !== undefined) conditions.push(eq(cards.isMentor, filters.isMentor));
    if (filters.isToken !== undefined) conditions.push(eq(cards.isToken, filters.isToken));

    // ===== BOOLEAN FLAGS - CLASS =====
    if (filters.isGeneric !== undefined) conditions.push(eq(cards.isGeneric, filters.isGeneric));
    if (filters.isBrute !== undefined) conditions.push(eq(cards.isBrute, filters.isBrute));
    if (filters.isGuardian !== undefined) conditions.push(eq(cards.isGuardian, filters.isGuardian));
    if (filters.isMechanologist !== undefined)
      conditions.push(eq(cards.isMechanologist, filters.isMechanologist));
    if (filters.isRanger !== undefined) conditions.push(eq(cards.isRanger, filters.isRanger));
    if (filters.isRuneblade !== undefined) conditions.push(eq(cards.isRuneblade, filters.isRuneblade));
    if (filters.isAssassin !== undefined) conditions.push(eq(cards.isAssassin, filters.isAssassin));
    if (filters.isWarrior !== undefined) conditions.push(eq(cards.isWarrior, filters.isWarrior));
    if (filters.isNinja !== undefined) conditions.push(eq(cards.isNinja, filters.isNinja));
    if (filters.isWizard !== undefined) conditions.push(eq(cards.isWizard, filters.isWizard));
    if (filters.isMerchant !== undefined) conditions.push(eq(cards.isMerchant, filters.isMerchant));
    if (filters.isBard !== undefined) conditions.push(eq(cards.isBard, filters.isBard));
    if (filters.isAdjudicator !== undefined) conditions.push(eq(cards.isAdjudicator, filters.isAdjudicator));
    if (filters.isIllusionist !== undefined) conditions.push(eq(cards.isIllusionist, filters.isIllusionist));
    if (filters.isThief !== undefined) conditions.push(eq(cards.isThief, filters.isThief));
    if (filters.isShapeshifter !== undefined)
      conditions.push(eq(cards.isShapeshifter, filters.isShapeshifter));
    if (filters.isNecromancer !== undefined)
      conditions.push(eq(cards.isNecromancer, filters.isNecromancer));

    // ===== BOOLEAN FLAGS - TALENT =====
    if (filters.hasChaos !== undefined) conditions.push(eq(cards.hasChaos, filters.hasChaos));
    if (filters.hasLight !== undefined) conditions.push(eq(cards.hasLight, filters.hasLight));
    if (filters.hasRoyal !== undefined) conditions.push(eq(cards.hasRoyal, filters.hasRoyal));
    if (filters.hasDraconic !== undefined) conditions.push(eq(cards.hasDraconic, filters.hasDraconic));
    if (filters.hasLightning !== undefined) conditions.push(eq(cards.hasLightning, filters.hasLightning));
    if (filters.hasShadow !== undefined) conditions.push(eq(cards.hasShadow, filters.hasShadow));
    if (filters.hasEarth !== undefined) conditions.push(eq(cards.hasEarth, filters.hasEarth));
    if (filters.hasMystic !== undefined) conditions.push(eq(cards.hasMystic, filters.hasMystic));
    if (filters.hasRevered !== undefined) conditions.push(eq(cards.hasRevered, filters.hasRevered));
    if (filters.hasIce !== undefined) conditions.push(eq(cards.hasIce, filters.hasIce));
    if (filters.hasReviled !== undefined) conditions.push(eq(cards.hasReviled, filters.hasReviled));
    if (filters.hasPirate !== undefined) conditions.push(eq(cards.hasPirate, filters.hasPirate));
    if (filters.hasElemental !== undefined) conditions.push(eq(cards.hasElemental, filters.hasElemental));

    // ===== COMBINATION FLAGS =====
    if (filters.isGenericOnly !== undefined)
      conditions.push(eq(cards.isGenericOnly, filters.isGenericOnly));
    if (filters.hasClassAndTalent !== undefined)
      conditions.push(eq(cards.hasClassAndTalent, filters.hasClassAndTalent));
    if (filters.hasClassOnly !== undefined)
      conditions.push(eq(cards.hasClassOnly, filters.hasClassOnly));
    if (filters.hasTalentOnly !== undefined)
      conditions.push(eq(cards.hasTalentOnly, filters.hasTalentOnly));

    // ===== EDITION/FOILING/RARITY FLAGS =====
    if (filters.isFirstEdition !== undefined)
      conditions.push(eq(printings.isFirstEdition, filters.isFirstEdition));
    if (filters.isUnlimited !== undefined)
      conditions.push(eq(printings.isUnlimited, filters.isUnlimited));
    if (filters.isNormalEdition !== undefined)
      conditions.push(eq(printings.isNormalEdition, filters.isNormalEdition));
    if (filters.isNormalFoil !== undefined)
      conditions.push(eq(printings.isNormalFoil, filters.isNormalFoil));
    if (filters.isRainbowFoil !== undefined)
      conditions.push(eq(printings.isRainbowFoil, filters.isRainbowFoil));
    if (filters.isColdFoil !== undefined)
      conditions.push(eq(printings.isColdFoil, filters.isColdFoil));
    if (filters.isExtendedArt !== undefined)
      conditions.push(eq(printings.isExtendedArt, filters.isExtendedArt));
    if (filters.isCommon !== undefined) conditions.push(eq(printings.isCommon, filters.isCommon));
    if (filters.isRare !== undefined) conditions.push(eq(printings.isRare, filters.isRare));
    if (filters.isSuperRare !== undefined)
      conditions.push(eq(printings.isSuperRare, filters.isSuperRare));
    if (filters.isMajestic !== undefined)
      conditions.push(eq(printings.isMajestic, filters.isMajestic));
    if (filters.isLegendary !== undefined)
      conditions.push(eq(printings.isLegendary, filters.isLegendary));
    if (filters.isFabled !== undefined) conditions.push(eq(printings.isFabled, filters.isFabled));
    if (filters.isPromo !== undefined) conditions.push(eq(printings.isPromo, filters.isPromo));

    // ===== PRICE CATEGORY FLAGS =====
    if (filters.isBudget !== undefined) conditions.push(eq(printings.isBudget, filters.isBudget));
    if (filters.isUnder5 !== undefined) conditions.push(eq(printings.isUnder5, filters.isUnder5));
    if (filters.isUnder10 !== undefined) conditions.push(eq(printings.isUnder10, filters.isUnder10));
    if (filters.isUnder25 !== undefined) conditions.push(eq(printings.isUnder25, filters.isUnder25));
    if (filters.isUnder50 !== undefined) conditions.push(eq(printings.isUnder50, filters.isUnder50));
    if (filters.isUnder100 !== undefined) conditions.push(eq(printings.isUnder100, filters.isUnder100));
    if (filters.isExpensive !== undefined)
      conditions.push(eq(printings.isExpensive, filters.isExpensive));
    if (filters.isPremium !== undefined) conditions.push(eq(printings.isPremium, filters.isPremium));

    // ===== FORMAT LEGALITY =====
    if (filters.format) {
      const legalField = {
        blitz: cards.blitzLegal,
        cc: cards.ccLegal,
        commoner: cards.commonerLegal,
        ll: cards.llLegal,
        silver_age: cards.silverAgeLegal,
      }[filters.format];

      if (legalField) {
        conditions.push(eq(legalField, true));
      }

      // Exclude banned unless explicitly included.
      // Source of truth is the `banned_cards` registry (managed via the admin
      // UI at /admin/banned-cards). The `cards.{format}_banned` columns are a
      // vestigial denormalized cache; the registry is queried directly so admin
      // toggles take effect immediately. See lib/services/postgres/banned-cards.
      if (!filters.includeBanned) {
        const registryFormat = {
          blitz: 'blitz',
          cc: 'classic_constructed',
          commoner: 'commoner',
          ll: 'living_legend',
          silver_age: 'silver_age',
        }[filters.format];
        if (registryFormat) {
          conditions.push(sql`NOT EXISTS (
            SELECT 1 FROM ${bannedCards}
            WHERE ${bannedCards.cardUniqueId} = ${cards.cardUniqueId}
              AND ${bannedCards.format} = ${registryFormat}
              AND ${bannedCards.restrictionType} = 'banned'
              AND ${bannedCards.statusActive} = true
          )`);
        }
      }

      // Exclude suspended unless explicitly included
      if (!filters.includeSuspended) {
        const suspendedField = {
          blitz: cards.blitzSuspended,
          cc: cards.ccSuspended,
          commoner: cards.commonerSuspended,
          ll: sql`false`, // LL doesn't have suspended
          silver_age: cards.silverAgeSuspended,
        }[filters.format];
        if (suspendedField) {
          conditions.push(eq(suspendedField, false));
        }
      }
    }

    // ===== HERO LEGAL FILTERING =====
    // When heroLegal is set without precise-mode fields, resolve the hero name
    // to its classes/talents/essences so the precise check below applies. Keeps
    // direct service callers (getPrintingsForHero, getDeckBuildingCards) and
    // MCP-translated calls on the same semantics.
    if (filters.heroLegal && filters.heroClasses === undefined && filters.heroTalents === undefined) {
      const names = Array.isArray(filters.heroLegal) ? filters.heroLegal : [filters.heroLegal];
      const allClasses = new Set<string>();
      const allTalents = new Set<string>();
      const allEssences = new Set<string>();
      let anyResolved = false;
      for (const name of names) {
        const info = getHeroInfo(name);
        if (info) {
          anyResolved = true;
          info.classes.forEach(c => allClasses.add(c.toLowerCase()));
          info.talents.forEach(t => allTalents.add(t.toLowerCase()));
          (info.essences ?? []).forEach(e => allEssences.add(e.toLowerCase()));
        }
      }
      if (anyResolved) {
        filters = {
          ...filters,
          heroClasses: [...allClasses],
          heroTalents: [...allTalents],
          heroEssences: [...allEssences, ...(filters.heroEssences || []).map(e => e.toLowerCase())],
          heroLegal: undefined,
        };
      }
    }

    // Precise mode: card.classes ⊆ heroClasses AND card.talents ⊆ heroTalents
    //
    // A card is legal for a hero only when the hero satisfies ALL of the card's requirements:
    //   Kayo (brute)           → generic + brute cards (no talent cards)
    //   Dorinthea (warrior)    → generic + warrior cards (NOT light-warrior)
    //   Boltyn (warrior+light) → generic + warrior + light + light-warrior
    //   Prism (illusionist+light) → generic + illusionist + light + light-illusionist (NOT light-warrior)
    if (filters.heroClasses !== undefined || filters.heroTalents !== undefined) {
      const heroClasses = (filters.heroClasses || []).map(c => c.toLowerCase());
      const heroTalents = (filters.heroTalents || []).map(t => t.toLowerCase());

      // card.classes must be ⊆ hero's classes (empty card classes = no class restriction = always ok)
      // 'generic' is always implicitly allowed — generic cards (classes = ['generic']) are playable by any hero
      // heroTalents and heroEssences are also included because some cards store their talent/essence element
      // in the classes column (e.g. classes=['lightning'] for an essence-of-lightning card)
      const heroEssences = (filters.heroEssences || []).map(e => e.toLowerCase());
      const allowedClasses = [...new Set(['generic', ...heroClasses, ...heroTalents, ...heroEssences])];
      // Use && (overlap) not <@ (subset): a multi-class card like ['ranger','assassin'] is legal
      // for an assassin hero because at least one class matches — not because all classes match.
      const classCheck = heroClasses.length > 0
        ? sql`(${cards.classes} IS NULL OR ${cards.classes} = '{}' OR ${cards.classes} && ARRAY[${sql.join(allowedClasses.map(c => sql`${c}`), sql`, `)}]::text[])`
        : sql`(${cards.classes} IS NULL OR ${cards.classes} = '{}' OR ${cards.classes} && ARRAY['generic']::text[])`;

      // card.talents must be ⊆ hero's talents (empty card talents = no talent restriction = always ok)
      // heroEssences are included so that elemental heroes (whose lightning/earth/ice access comes from
      // "essence of X" keywords rather than a standard talent field) can play talent-tagged cards like
      // Channel Lightning Valley which has talents=['lightning'] but is legal for any lightning-essence hero.
      const allowedTalents = [...new Set([...heroTalents, ...heroEssences])];
      const talentCheck = allowedTalents.length > 0
        ? sql`(${cards.talents} IS NULL OR ${cards.talents} = '{}' OR ${cards.talents} <@ ARRAY[${sql.join(allowedTalents.map(t => sql`${t}`), sql`, `)}]::text[])`
        : sql`(${cards.talents} IS NULL OR ${cards.talents} = '{}')`;

      conditions.push(and(classCheck, talentCheck));
    }
    // Legacy mode: OR-based matching (used by getPrintingsForHero / getDeckBuildingCards)
    else if (filters.heroLegal) {
      const heroValues = Array.isArray(filters.heroLegal)
        ? filters.heroLegal.map(v => v.toLowerCase())
        : [filters.heroLegal.toLowerCase()];

      const classOrTalentConditions = heroValues.flatMap(v => [
        sql`${cards.classes} && ARRAY[${v}]::text[]`,
        sql`${cards.talents} && ARRAY[${v}]::text[]`,
      ]);

      conditions.push(or(eq(cards.isGenericOnly, true), ...classOrTalentConditions));
    }

    if (filters.excludeClasses && filters.excludeClasses.length > 0) {
      conditions.push(sql`NOT (${cards.classes} && ${lc(filters.excludeClasses)})`);
    }

    if (filters.excludeTalents && filters.excludeTalents.length > 0) {
      conditions.push(sql`NOT (${cards.talents} && ${lc(filters.excludeTalents)})`);
    }

    // ===== NEGATION FILTERS =====
    if (filters.colorNot && filters.colorNot.length > 0) {
      conditions.push(notInArray(cards.color, lc(filters.colorNot)));
    }

    if (filters.raritiesNot && filters.raritiesNot.length > 0) {
      conditions.push(notInArray(printings.rarity, lc(filters.raritiesNot)));
    }

    if (filters.setsNot && filters.setsNot.length > 0) {
      conditions.push(notInArray(printings.set, filters.setsNot.map((s) => s.toLowerCase())));
    }

    if (filters.foilingsNot && filters.foilingsNot.length > 0) {
      conditions.push(notInArray(printings.foiling, lc(filters.foilingsNot)));
    }

    if (filters.editionsNot && filters.editionsNot.length > 0) {
      conditions.push(notInArray(printings.edition, lc(filters.editionsNot)));
    }

    if (filters.typesNot && filters.typesNot.length > 0) {
      conditions.push(sql`NOT (${cards.types} && ARRAY[${sql.join(lc(filters.typesNot).map(t => sql`${t}`), sql`, `)}]::text[])`);
    }

    if (filters.keywordsNot && filters.keywordsNot.length > 0) {
      conditions.push(sql`NOT (${cards.keywords} && ${lc(filters.keywordsNot)})`);
    }

    if (filters.textNot) {
      conditions.push(sql`${cards.text} NOT ILIKE ${`%${filters.textNot}%`}`);
    }

    return conditions;
  }

  /**
   * Build ORDER BY clause from options
   */
  private buildOrderBy(options?: PrintingsSearchOptions, priceField?: string, filters?: PrintingsSearchFilters): any[] {
    const sortBy = options?.sortBy || 'name';
    const sortOrder = options?.sortOrder || 'asc';

    const orderFn = sortOrder === 'desc' ? desc : asc;

    switch (sortBy) {
      case 'name': {
        // Use word_similarity for sorting so split cards (e.g. "Comet Storm // Shock") rank
        // correctly when searching a single face name (e.g. "shock"). word_similarity finds the
        // best word-level match within the full name, unlike <-> which compares full strings.
        if (filters?.name && !filters.exact) {
          const normalizedName = filters.name.replace(/[\u2018\u2019\u0027\u0060]/g, "'").toLowerCase().trim();
          return [desc(sql`word_similarity(${normalizedName}, ${cards.name})`), orderFn(cards.name)];
        }
        if (filters?.searchableText) {
          const normalizedQuery = filters.searchableText.replace(/[\u2018\u2019\u0027\u0060]/g, "'").toLowerCase().trim();
          return [desc(sql`word_similarity(${normalizedQuery}, ${cards.name})`), orderFn(cards.name)];
        }
        return [orderFn(cards.name)];
      }
      case 'relevance': {
        if (filters?.name && !filters.exact) {
          const normalizedName = filters.name.replace(/[\u2018\u2019\u0027\u0060]/g, "'").toLowerCase().trim();
          return [desc(sql`word_similarity(${normalizedName}, ${cards.name})`)];
        }
        if (filters?.searchableText) {
          const normalizedQuery = filters.searchableText.replace(/[\u2018\u2019\u0027\u0060]/g, "'").toLowerCase().trim();
          return [desc(sql`word_similarity(${normalizedQuery}, ${cards.name})`)];
        }
        return [orderFn(cards.name)];
      }
      case 'price': {
        const priceColMap: Record<string, any> = {
          tcg_low:    printings.tcgLow,
          tcg_mid:    printings.tcgMid,
          tcg_high:   printings.tcgHigh,
          tcg_market: printings.tcgMarket,
        };
        const priceCol = priceColMap[priceField || 'tcg_market'] ?? printings.tcgMarket;
        return [orderFn(priceCol), orderFn(cards.name)];
      }
      case 'power':
        return [orderFn(cards.power), orderFn(cards.name)];
      case 'cost':
        return [orderFn(cards.cost), orderFn(cards.name)];
      case 'defense':
        return [orderFn(cards.defense), orderFn(cards.name)];
      case 'set':
        return [orderFn(printings.set), orderFn(cards.name)];
      case 'rarity':
        return [orderFn(printings.rarity), orderFn(cards.name)];
      case 'collector_number':
        return [orderFn(printings.collectorNumber), orderFn(cards.name)];
      default:
        return [orderFn(cards.name)];
    }
  }

  /**
   * Map database row to PrintingDTO
   */
  private mapToPrintingDTO(row: any): PrintingDTO {
    return {
      _id: row.printingId,
      printing_id: row.printingId,
      card_unique_id: row.cardUniqueId,
      name: row.displayName || row.name,
      text: row.text || '',
      type_text: row.typeText || '',
      type_text_display: row.typeTextDisplay || '',
      color: row.color || '',
      types: row.types || [],
      traits: row.traits || [],
      keywords: row.keywords || [],
      keywords_display: row.keywordsDisplay || [],
      abilities: row.abilities || [],
      text_keywords: [], // Not stored separately in PostgreSQL
      searchable_text: row.searchableText || '',
      classes: row.classes || [],
      talents: row.talents || [],
      power: row.power ?? null,
      cost: row.cost ?? null,
      defense: row.defense ?? null,
      pitch: row.pitch ?? null,
      health: row.health ?? null,
      intelligence: row.intelligence ?? null,
      power_text: row.powerText || '',
      cost_text: row.costText || '',
      defense_text: row.defenseText || '',
      pitch_text: row.pitchText || '',
      collector_number: row.collectorNumber || '',
      set: row.set,
      edition: row.edition,
      foiling: row.foiling,
      rarity: row.rarity,
      language: row.language || 'en',
      artists: row.artists || [],
      tcg_low: row.tcgLow ?? null,
      tcg_mid: row.tcgMid ?? null,
      tcg_high: row.tcgHigh ?? null,
      tcg_market: row.tcgMarket ?? null,
      price_updated_at: row.priceUpdatedAt,
      is_action: row.isAction || false,
      is_attack: row.isAttack || false,
      is_defense_reaction: row.isDefenseReaction || false,
      is_instant: row.isInstant || false,
      is_equipment: row.isEquipment || false,
      is_weapon: row.isWeapon || false,
      is_hero: row.isHero || false,
      is_mentor: row.isMentor || false,
      is_token: row.isToken || false,
      is_generic: row.isGeneric || false,
      is_brute: row.isBrute || false,
      is_guardian: row.isGuardian || false,
      is_mechanologist: row.isMechanologist || false,
      is_ranger: row.isRanger || false,
      is_runeblade: row.isRuneblade || false,
      is_assassin: row.isAssassin || false,
      is_warrior: row.isWarrior || false,
      is_ninja: row.isNinja || false,
      is_wizard: row.isWizard || false,
      is_merchant: row.isMerchant || false,
      is_bard: row.isBard || false,
      is_adjudicator: row.isAdjudicator || false,
      is_illusionist: row.isIllusionist || false,
      is_thief: row.isThief || false,
      is_shapeshifter: row.isShapeshifter || false,
      is_necromancer: row.isNecromancer || false,
      has_chaos: row.hasChaos || false,
      has_light: row.hasLight || false,
      has_royal: row.hasRoyal || false,
      has_draconic: row.hasDraconic || false,
      has_lightning: row.hasLightning || false,
      has_shadow: row.hasShadow || false,
      has_earth: row.hasEarth || false,
      has_mystic: row.hasMystic || false,
      has_revered: row.hasRevered || false,
      has_ice: row.hasIce || false,
      has_reviled: row.hasReviled || false,
      has_pirate: row.hasPirate || false,
      has_elemental: row.hasElemental || false,
      is_generic_only: row.isGenericOnly || false,
      has_class_and_talent: row.hasClassAndTalent || false,
      has_class_only: row.hasClassOnly || false,
      has_talent_only: row.hasTalentOnly || false,
      is_first_edition: row.isFirstEdition || false,
      is_unlimited: row.isUnlimited || false,
      is_normal_edition: row.isNormalEdition || false,
      is_normal_foil: row.isNormalFoil || false,
      is_rainbow_foil: row.isRainbowFoil || false,
      is_cold_foil: row.isColdFoil || false,
      is_extended_art: row.isExtendedArt || false,
      art_variations: row.artVariations || [],
      foil_inset_top: row.foilInsetTop ?? null,
      foil_inset_right: row.foilInsetRight ?? null,
      foil_inset_bottom: row.foilInsetBottom ?? null,
      foil_inset_left: row.foilInsetLeft ?? null,
      foil_inset_round: row.foilInsetRound ?? null,
      is_common: row.isCommon || false,
      is_rare: row.isRare || false,
      is_super_rare: row.isSuperRare || false,
      is_majestic: row.isMajestic || false,
      is_legendary: row.isLegendary || false,
      is_fabled: row.isFabled || false,
      is_promo: row.isPromo || false,
      is_budget: row.isBudget || false,
      is_under_5: row.isUnder5 || false,
      is_under_10: row.isUnder10 || false,
      is_under_25: row.isUnder25 || false,
      is_under_50: row.isUnder50 || false,
      is_under_100: row.isUnder100 || false,
      is_expensive: row.isExpensive || false,
      is_premium: row.isPremium || false,
      blitz_legal: row.blitzLegal || false,
      cc_legal: row.ccLegal || false,
      commoner_legal: row.commonerLegal || false,
      ll_legal: row.llLegal || false,
      silver_age_legal: row.silverAgeLegal || false,
      blitz_banned: row.blitzBanned || false,
      cc_banned: row.ccBanned || false,
      commoner_banned: row.commonerBanned || false,
      ll_banned: row.llBanned || false,
      silver_age_banned: row.silverAgeBanned || false,
      blitz_suspended: row.blitzSuspended || false,
      cc_suspended: row.ccSuspended || false,
      commoner_suspended: row.commonerSuspended || false,
      ll_restricted: row.llRestricted || false,
      silver_age_suspended: row.silverAgeSuspended || false,
      played_horizontally: row.playedHorizontally || false,
      expansion_slot: row.expansionSlot || false,
      other_face_printing_id: row.otherFacePrintingId ?? null,
      is_front_face: row.isFrontFace ?? true,
      flavor_text: row.flavorText || '',
      image_url: row.imageUrl || '',
      tcgplayer_product_id: row.tcgplayerProductId,
      tcgplayer_url: row.tcgplayerUrl,
      created_at: row.cardCreatedAt || row.printingCreatedAt,
      printing_data: undefined, // Not stored in PostgreSQL
    };
  }

  async listHeroCards(opts?: { legalIn?: HeroFormat }): AsyncResult<HeroLegalityRow[]> {
    try {
      if (opts?.legalIn && !HERO_FORMATS.includes(opts.legalIn)) {
        return { success: false, error: `Unknown format: ${opts.legalIn}` };
      }

      const FORMAT_TO_COLUMN: Record<HeroFormat, any> = {
        cc: cards.ccLegal,
        blitz: cards.blitzLegal,
        silver_age: cards.silverAgeLegal,
        commoner: cards.commonerLegal,
        ll: cards.llLegal,
      };

      const whereConditions = [sql`'hero' = ANY(${cards.types})`];
      if (opts?.legalIn) {
        whereConditions.push(eq(FORMAT_TO_COLUMN[opts.legalIn], true));
      }

      const heroRows = await db
        .select({
          cardUniqueId: cards.cardUniqueId,
          displayName: cards.displayName,
          name: cards.name,
          types: cards.types,
          classes: cards.classes,
          ccLegal: cards.ccLegal,
          blitzLegal: cards.blitzLegal,
          silverAgeLegal: cards.silverAgeLegal,
          commonerLegal: cards.commonerLegal,
          llLegal: cards.llLegal,
        })
        .from(cards)
        .where(and(...whereConditions))
        .orderBy(
          // Adults first, then young (false sorts before true)
          sql`('young' = ANY(${cards.types}))`,
          // Then by class (first entry in the classes array)
          sql`${cards.classes}[1]`,
          asc(cards.displayName),
        );

      const heroIds = heroRows.map(r => r.cardUniqueId);
      const imageByCardId = new Map<string, string>();
      if (heroIds.length > 0) {
        const printingRows = await db
          .select({ cardUniqueId: printings.cardUniqueId, imageUrl: printings.imageUrl })
          .from(printings)
          .where(
            and(
              inArray(printings.cardUniqueId, heroIds),
              sql`${printings.imageUrl} IS NOT NULL AND ${printings.imageUrl} <> ''`,
            ),
          );
        for (const p of printingRows) {
          if (!imageByCardId.has(p.cardUniqueId) && p.imageUrl) {
            imageByCardId.set(p.cardUniqueId, p.imageUrl);
          }
        }
      }

      return {
        success: true,
        data: heroRows.map(r => ({
          cardUniqueId: r.cardUniqueId,
          name: r.name,
          displayName: r.displayName || r.name,
          imageUrl: imageByCardId.get(r.cardUniqueId) ?? null,
          types: r.types ?? [],
          klass: (r.classes && r.classes[0]) || null,
          ccLegal: r.ccLegal,
          blitzLegal: r.blitzLegal,
          silverAgeLegal: r.silverAgeLegal,
          commonerLegal: r.commonerLegal,
          llLegal: r.llLegal,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to list hero cards' };
    }
  }

  async setHeroLegality(
    cardUniqueId: string,
    flag: HeroLegalityFlag,
    value: boolean,
  ): AsyncResult<void> {
    if (!HERO_LEGALITY_FLAGS.includes(flag)) {
      return { success: false, error: `Unknown legality flag: ${flag}` };
    }

    const column: Record<HeroLegalityFlag, keyof typeof cards.$inferSelect> = {
      cc_legal: 'ccLegal',
      blitz_legal: 'blitzLegal',
      silver_age_legal: 'silverAgeLegal',
      commoner_legal: 'commonerLegal',
      ll_legal: 'llLegal',
    };

    try {
      const row = await db
        .select({ types: cards.types })
        .from(cards)
        .where(eq(cards.cardUniqueId, cardUniqueId))
        .limit(1);
      if (row.length === 0) {
        return { success: false, error: `Card not found: ${cardUniqueId}` };
      }
      if (!(row[0].types ?? []).includes('hero')) {
        return { success: false, error: `Card is not a hero: ${cardUniqueId}` };
      }

      await db
        .update(cards)
        .set({ [column[flag]]: value } as any)
        .where(eq(cards.cardUniqueId, cardUniqueId));

      return { success: true, data: undefined };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update hero legality' };
    }
  }

  async setHeroYoung(cardUniqueId: string, value: boolean): AsyncResult<void> {
    try {
      const row = await db
        .select({ types: cards.types })
        .from(cards)
        .where(eq(cards.cardUniqueId, cardUniqueId))
        .limit(1);
      if (row.length === 0) {
        return { success: false, error: `Card not found: ${cardUniqueId}` };
      }
      if (!(row[0].types ?? []).includes('hero')) {
        return { success: false, error: `Card is not a hero: ${cardUniqueId}` };
      }

      // Always strip first, then append if true — guarantees idempotency.
      const expr = value
        ? sql`array_append(array_remove(${cards.types}, 'young'), 'young')`
        : sql`array_remove(${cards.types}, 'young')`;

      await db
        .update(cards)
        .set({ types: expr as any })
        .where(eq(cards.cardUniqueId, cardUniqueId));

      return { success: true, data: undefined };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update hero young flag' };
    }
  }
}
