import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { cards, cardFacetTags, facetTagDefinitions } from '@/lib/postgres/schema';
import type {
  IFacetService,
  FacetTagDefinitionDTO,
  FacetTagDefinitionWithCount,
  CreateFacetTagInput,
  FacetDimension,
} from '@/lib/services/contracts/IFacetService';
import type { AsyncResult } from '@/lib/services/contracts/common';

const DIMENSIONS: readonly FacetDimension[] = ['mechanical', 'strategic', 'synergy'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Postgres implementation of the facet content manager. Imports db/schema
 * directly (never @/lib/services) to avoid the ServiceFactory circular-dep.
 */
export class PostgresFacetService implements IFacetService {
  async listTagDefinitions(): AsyncResult<FacetTagDefinitionDTO[]> {
    try {
      const rows = await db
        .select()
        .from(facetTagDefinitions)
        .orderBy(asc(facetTagDefinitions.dim), asc(facetTagDefinitions.label));
      return { success: true, data: rows.map(toDTO) };
    } catch (error) {
      return fail(error, 'Failed to list facet tags');
    }
  }

  async getTagUsageCounts(): AsyncResult<FacetTagDefinitionWithCount[]> {
    try {
      // Count distinct card NAMES (tags apply per name; the grid shows one tile
      // per name), so the count matches what a curator sees and the delete guard.
      const result = await db.execute(sql`
        SELECT d.id, d.dim, d.label, d.def, d.draft,
               COUNT(DISTINCT c.display_name)::int AS card_count
        FROM ${facetTagDefinitions} d
        LEFT JOIN ${cardFacetTags} cft ON cft.tag = d.id
        LEFT JOIN ${cards} c ON c.card_unique_id = cft.card_unique_id
        GROUP BY d.id, d.dim, d.label, d.def, d.draft
        ORDER BY d.dim, d.label
      `);
      const rows = (result as unknown as { rows: any[] }).rows ?? (result as unknown as any[]);
      return {
        success: true,
        data: rows.map((r: any) => ({
          id: r.id,
          dim: r.dim as FacetDimension,
          label: r.label,
          def: r.def,
          draft: r.draft,
          cardCount: Number(r.card_count) || 0,
        })),
      };
    } catch (error) {
      return fail(error, 'Failed to load facet usage counts');
    }
  }

  async createTagDefinition(input: CreateFacetTagInput): AsyncResult<FacetTagDefinitionDTO> {
    try {
      const id = input.id?.trim();
      if (!id || !SLUG_RE.test(id)) {
        return { success: false, error: 'Tag id must be a lowercase slug (e.g. "combo-enabler")' };
      }
      if (!DIMENSIONS.includes(input.dim)) {
        return { success: false, error: `dim must be one of: ${DIMENSIONS.join(', ')}` };
      }
      if (!input.label?.trim()) {
        return { success: false, error: 'label is required' };
      }

      const [existing] = await db
        .select({ id: facetTagDefinitions.id })
        .from(facetTagDefinitions)
        .where(eq(facetTagDefinitions.id, id))
        .limit(1);
      if (existing) {
        return { success: false, error: `Tag "${id}" already exists` };
      }

      const [row] = await db
        .insert(facetTagDefinitions)
        .values({ id, dim: input.dim, label: input.label.trim(), def: input.def?.trim() ?? '', draft: input.draft ?? false })
        .returning();
      return { success: true, data: toDTO(row) };
    } catch (error) {
      return fail(error, 'Failed to create facet tag');
    }
  }

  async deleteTagDefinition(id: string): AsyncResult<{ deleted: true }> {
    try {
      const [assigned] = await db
        .select({ tag: cardFacetTags.tag })
        .from(cardFacetTags)
        .where(eq(cardFacetTags.tag, id))
        .limit(1);
      if (assigned) {
        return { success: false, error: 'Tag is assigned to one or more cards; unassign it first.' };
      }
      await db.delete(facetTagDefinitions).where(eq(facetTagDefinitions.id, id));
      return { success: true, data: { deleted: true } };
    } catch (error) {
      // FK ON DELETE RESTRICT backstop (23503) — race between the check and delete.
      if (error instanceof Error && /foreign key|23503/i.test(error.message)) {
        return { success: false, error: 'Tag is assigned to one or more cards; unassign it first.' };
      }
      return fail(error, 'Failed to delete facet tag');
    }
  }

  async addCardFacetTag(cardUniqueId: string, tag: string): AsyncResult<{ applied: number }> {
    return this.mutate(cardUniqueId, tag, 'add');
  }

  async removeCardFacetTag(cardUniqueId: string, tag: string): AsyncResult<{ applied: number }> {
    return this.mutate(cardUniqueId, tag, 'remove');
  }

  /**
   * Add/remove one tag across every same-display_name variant, then re-project
   * cards.facet_tags from the surviving card_facet_tags rows. Only ever writes
   * the facet_tags column; the whole fan-out runs in one transaction.
   */
  private async mutate(cardUniqueId: string, tag: string, op: 'add' | 'remove'): AsyncResult<{ applied: number }> {
    try {
      if (op === 'add') {
        const [def] = await db
          .select({ id: facetTagDefinitions.id })
          .from(facetTagDefinitions)
          .where(eq(facetTagDefinitions.id, tag))
          .limit(1);
        if (!def) return { success: false, error: `Unknown facet tag: ${tag}` };
      }

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

      await db.transaction(async (tx) => {
        for (const { id } of variants) {
          if (op === 'add') {
            await tx.insert(cardFacetTags).values({ cardUniqueId: id, tag }).onConflictDoNothing();
          } else {
            await tx.delete(cardFacetTags).where(and(eq(cardFacetTags.cardUniqueId, id), eq(cardFacetTags.tag, tag)));
          }
          // Re-project from the source of truth — never trust an in-memory array.
          await tx
            .update(cards)
            .set({
              facetTags: sql`COALESCE((SELECT array_agg(${cardFacetTags.tag} ORDER BY ${cardFacetTags.tag}) FROM ${cardFacetTags} WHERE ${cardFacetTags.cardUniqueId} = ${id}), ARRAY[]::text[])`,
            })
            .where(eq(cards.cardUniqueId, id));
        }
      });

      return { success: true, data: { applied: variants.length } };
    } catch (error) {
      return fail(error, 'Failed to update card facet tag');
    }
  }
}

function toDTO(row: typeof facetTagDefinitions.$inferSelect): FacetTagDefinitionDTO {
  return { id: row.id, dim: row.dim as FacetDimension, label: row.label, def: row.def, draft: row.draft };
}

function fail(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message : fallback };
}
