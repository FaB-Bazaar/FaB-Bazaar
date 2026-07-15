import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import {
  cards,
  cardFacetTags,
  cardFacetTagVotes,
  facetTagAudit,
  facetTagDefinitions,
  facetTagSuggestions,
  users,
} from '@/lib/postgres/schema';
import { displayUsername } from '@/lib/utils/display-username';
import type {
  IFacetService,
  FacetTagDefinitionDTO,
  FacetTagDefinitionWithCount,
  CreateFacetTagInput,
  UpdateFacetTagInput,
  CardCommunityTag,
  CardFacetSummaryTag,
  FacetSuggestionDTO,
  CreateSuggestionInput,
  ApproveSuggestionOverrides,
  SuggestionStatus,
  FacetDimension,
  FacetAssignScope,
} from '@/lib/services/contracts/IFacetService';
import type { AsyncResult } from '@/lib/services/contracts/common';

const DIMENSIONS: readonly FacetDimension[] = ['mechanical', 'strategic', 'synergy'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Distinct community voters required before a tag enters cards.facet_tags. */
export const COMMUNITY_VOTE_THRESHOLD = 2;

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

  async updateTagDefinition(id: string, input: UpdateFacetTagInput): AsyncResult<FacetTagDefinitionDTO> {
    try {
      if (input.dim !== undefined && !DIMENSIONS.includes(input.dim)) {
        return { success: false, error: `dim must be one of: ${DIMENSIONS.join(', ')}` };
      }
      if (input.label !== undefined && !input.label.trim()) {
        return { success: false, error: 'label is required' };
      }

      // Only assign provided fields; the slug id is immutable and never updated.
      const patch: Partial<typeof facetTagDefinitions.$inferInsert> = {};
      if (input.dim !== undefined) patch.dim = input.dim;
      if (input.label !== undefined) patch.label = input.label.trim();
      if (input.def !== undefined) patch.def = input.def.trim();
      if (input.draft !== undefined) patch.draft = input.draft;
      if (Object.keys(patch).length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      const [row] = await db
        .update(facetTagDefinitions)
        .set(patch)
        .where(eq(facetTagDefinitions.id, id))
        .returning();
      if (!row) return { success: false, error: `Tag "${id}" not found` };
      return { success: true, data: toDTO(row) };
    } catch (error) {
      return fail(error, 'Failed to update facet tag');
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

  async addCardFacetTag(cardUniqueId: string, tag: string, scope: FacetAssignScope = 'name'): AsyncResult<{ applied: number }> {
    return this.mutate(cardUniqueId, tag, 'add', scope);
  }

  async setStrategyNotes(cardUniqueId: string, notes: string | null): AsyncResult<{ updated: true }> {
    try {
      const value = notes?.trim() ? notes.trim() : null;
      const rows = await db
        .update(cards)
        .set({ strategyNotes: value })
        .where(eq(cards.cardUniqueId, cardUniqueId))
        .returning({ id: cards.cardUniqueId });
      if (rows.length === 0) return { success: false, error: 'Card not found' };
      return { success: true, data: { updated: true } };
    } catch (error) {
      return fail(error, 'Failed to set strategy notes');
    }
  }

  async getStrategyNotes(cardUniqueId: string): AsyncResult<{ notes: string | null }> {
    try {
      const [row] = await db
        .select({ notes: cards.strategyNotes })
        .from(cards)
        .where(eq(cards.cardUniqueId, cardUniqueId))
        .limit(1);
      if (!row) return { success: false, error: 'Card not found' };
      return { success: true, data: { notes: row.notes ?? null } };
    } catch (error) {
      return fail(error, 'Failed to read strategy notes');
    }
  }

  async removeCardFacetTag(cardUniqueId: string, tag: string, scope: FacetAssignScope = 'name'): AsyncResult<{ applied: number }> {
    return this.mutate(cardUniqueId, tag, 'remove', scope);
  }

  /**
   * Add/remove one tag, then re-project cards.facet_tags from the surviving
   * card_facet_tags rows. scope 'name' spans every same-display_name variant;
   * scope 'card' touches only the given card. Only ever writes the facet_tags
   * column; the whole mutation runs in one transaction.
   */
  private async mutate(cardUniqueId: string, tag: string, op: 'add' | 'remove', scope: FacetAssignScope = 'name'): AsyncResult<{ applied: number }> {
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

      const variants =
        scope === 'card'
          ? [{ id: cardUniqueId }]
          : await db
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
          await reproject(tx, id);
        }
      });

      return { success: true, data: { applied: variants.length } };
    } catch (error) {
      return fail(error, 'Failed to update card facet tag');
    }
  }

  async voteCardFacetTag(
    cardUniqueId: string,
    tag: string,
    userId: string,
    visibility: 'private' | 'public' = 'private',
  ): AsyncResult<{ votes: number; applied: number }> {
    // 'public' is a REQUEST — it lands as 'pending' until a curator approves.
    return this.vote(cardUniqueId, tag, userId, 'add', visibility === 'public' ? 'pending' : 'private');
  }

  async unvoteCardFacetTag(cardUniqueId: string, tag: string, userId: string): AsyncResult<{ votes: number; applied: number }> {
    return this.vote(cardUniqueId, tag, userId, 'remove');
  }

  /** Curator: approve a pending public request -> 'public' (now counts toward the threshold). */
  async approveFacetVote(cardUniqueId: string, tag: string, userId: string, reviewerId: string): AsyncResult<Record<string, never>> {
    return this.setVoteStatusAcrossVariants(cardUniqueId, tag, userId, 'public', reviewerId);
  }

  /** Curator: reject a pending request -> back to 'private' (stays the voter's personal tag). */
  async rejectFacetVote(cardUniqueId: string, tag: string, userId: string, reviewerId: string): AsyncResult<Record<string, never>> {
    return this.setVoteStatusAcrossVariants(cardUniqueId, tag, userId, 'private', reviewerId);
  }

  /** Owner: toggle their own vote. 'public' re-enters the approval queue (pending); 'private' is immediate. */
  async setFacetVoteVisibility(cardUniqueId: string, tag: string, userId: string, visibility: 'private' | 'public'): AsyncResult<Record<string, never>> {
    return this.setVoteStatusAcrossVariants(cardUniqueId, tag, userId, visibility === 'public' ? 'pending' : 'private', null);
  }

  /** The curator approval queue: one row per (card name, tag, requester), deduped across pitch variants. */
  async listPendingFacetVotes(): AsyncResult<
    { cardUniqueId: string; tag: string; userId: string; username: string; cardName: string }[]
  > {
    try {
      const rows = await db
        .select({
          cardUniqueId: cardFacetTagVotes.cardUniqueId,
          tag: cardFacetTagVotes.tag,
          userId: cardFacetTagVotes.userId,
          username: users.username,
          cardName: cards.displayName,
        })
        .from(cardFacetTagVotes)
        .innerJoin(users, eq(users.id, cardFacetTagVotes.userId))
        .innerJoin(cards, eq(cards.cardUniqueId, cardFacetTagVotes.cardUniqueId))
        .where(eq(cardFacetTagVotes.status, 'pending'));

      const seen = new Set<string>();
      const deduped: { cardUniqueId: string; tag: string; userId: string; username: string; cardName: string }[] = [];
      for (const r of rows) {
        const key = `${r.cardName} ${r.tag} ${r.userId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push({ ...r, username: displayUsername(r.username) });
      }
      return { success: true, data: deduped };
    } catch (error) {
      return fail(error, 'Failed to list pending facet votes');
    }
  }

  /** Fan a vote's status change across every same-name variant, re-projecting each. */
  private async setVoteStatusAcrossVariants(
    cardUniqueId: string,
    tag: string,
    userId: string,
    status: 'private' | 'pending' | 'public',
    reviewerId: string | null,
  ): AsyncResult<Record<string, never>> {
    try {
      const [card] = await db.select({ name: cards.displayName }).from(cards).where(eq(cards.cardUniqueId, cardUniqueId)).limit(1);
      if (!card) return { success: false, error: 'Card not found' };

      const variants = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, card.name));
      const reviewedAt = reviewerId ? new Date() : null;

      await db.transaction(async (tx) => {
        for (const { id } of variants) {
          await tx
            .update(cardFacetTagVotes)
            .set({ status, reviewedBy: reviewerId, reviewedAt })
            .where(and(eq(cardFacetTagVotes.cardUniqueId, id), eq(cardFacetTagVotes.tag, tag), eq(cardFacetTagVotes.userId, userId)));
          await reproject(tx, id);
        }
      });
      return { success: true, data: {} };
    } catch (error) {
      return fail(error, 'Failed to update facet vote status');
    }
  }

  /**
   * Cast/retract one community vote across every same-name variant, re-project
   * (curator tags ∪ community tags ≥ threshold), and write ONE append-only audit
   * row against the clicked card. The whole fan-out runs in one transaction.
   */
  private async vote(
    cardUniqueId: string,
    tag: string,
    userId: string,
    op: 'add' | 'remove',
    status: 'private' | 'pending' | 'public' = 'private',
  ): AsyncResult<{ votes: number; applied: number }> {
    try {
      const [def] = await db
        .select({ id: facetTagDefinitions.id })
        .from(facetTagDefinitions)
        .where(eq(facetTagDefinitions.id, tag))
        .limit(1);
      if (!def) return { success: false, error: `Unknown facet tag: ${tag}` };

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
            await tx.insert(cardFacetTagVotes).values({ cardUniqueId: id, tag, userId, status }).onConflictDoNothing();
          } else {
            await tx
              .delete(cardFacetTagVotes)
              .where(and(eq(cardFacetTagVotes.cardUniqueId, id), eq(cardFacetTagVotes.tag, tag), eq(cardFacetTagVotes.userId, userId)));
          }
          await reproject(tx, id);
        }
        await tx.insert(facetTagAudit).values({ cardUniqueId, tag, action: op, userId });
      });

      const [row] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${cardFacetTagVotes.userId})::int` })
        .from(cardFacetTagVotes)
        .where(and(eq(cardFacetTagVotes.cardUniqueId, cardUniqueId), eq(cardFacetTagVotes.tag, tag)));

      return { success: true, data: { votes: Number(row?.count) || 0, applied: variants.length } };
    } catch (error) {
      return fail(error, 'Failed to record facet vote');
    }
  }

  async getCardCommunityTags(cardUniqueId: string, userId?: string): AsyncResult<CardCommunityTag[]> {
    try {
      // Public count = 'public' votes only. `mine`/`myStatus` reflect the viewer's
      // own vote of ANY visibility (personal truth). A tag is listed only if it has
      // a public vote OR the viewer voted it — never leak others' private/pending.
      const votedByMe = userId ? sql`BOOL_OR(${cardFacetTagVotes.userId} = ${userId})` : sql`false`;
      const myStatus = userId
        ? sql`MAX(CASE WHEN ${cardFacetTagVotes.userId} = ${userId} THEN ${cardFacetTagVotes.status} END)`
        : sql`NULL`;
      const mineHaving = userId ? sql` OR BOOL_OR(${cardFacetTagVotes.userId} = ${userId})` : sql``;
      const result = await db.execute(sql`
        SELECT ${cardFacetTagVotes.tag} AS tag,
               (COUNT(DISTINCT ${cardFacetTagVotes.userId}) FILTER (WHERE ${cardFacetTagVotes.status} = 'public'))::int AS votes,
               ${votedByMe} AS voted_by_me,
               ${myStatus} AS my_status
        FROM ${cardFacetTagVotes}
        WHERE ${cardFacetTagVotes.cardUniqueId} = ${cardUniqueId}
        GROUP BY ${cardFacetTagVotes.tag}
        HAVING (COUNT(*) FILTER (WHERE ${cardFacetTagVotes.status} = 'public')) > 0${mineHaving}
        ORDER BY votes DESC, tag ASC
      `);
      const rows = (result as unknown as { rows: any[] }).rows ?? (result as unknown as any[]);
      return {
        success: true,
        data: rows.map((r: any) => ({
          tag: r.tag,
          votes: Number(r.votes) || 0,
          votedByMe: r.voted_by_me === true,
          myStatus: (r.my_status ?? null) as CardCommunityTag['myStatus'],
        })),
      };
    } catch (error) {
      return fail(error, 'Failed to read community facet tags');
    }
  }

  async getFacetSummaryForCards(cardUniqueIds: string[], viewerId?: string): AsyncResult<Record<string, CardFacetSummaryTag[]>> {
    try {
      if (cardUniqueIds.length === 0) return { success: true, data: {} };

      // Two simple reads merged in JS: the live projection, and community counts
      // (with a per-tag "did the viewer vote this" flag for personal-truth display).
      const liveRows = await db
        .select({ id: cards.cardUniqueId, ft: cards.facetTags })
        .from(cards)
        .where(and(inArray(cards.cardUniqueId, cardUniqueIds), sql`${cards.facetTags} <> '{}'`));

      // The public count reflects ONLY 'public'-status votes — private/pending
      // votes never leak into another user's view. `mine` still reflects the
      // viewer's own vote of ANY status (personal truth). A (card, tag) row is
      // included only if it has a public vote OR the viewer voted it themselves.
      const mineExpr = viewerId ? sql`BOOL_OR(${cardFacetTagVotes.userId} = ${viewerId})` : sql`false`;
      const mineHaving = viewerId ? sql` OR BOOL_OR(${cardFacetTagVotes.userId} = ${viewerId})` : sql``;
      const voteResult = await db.execute(sql`
        SELECT ${cardFacetTagVotes.cardUniqueId} AS id, ${cardFacetTagVotes.tag} AS tag,
               (COUNT(DISTINCT ${cardFacetTagVotes.userId}) FILTER (WHERE ${cardFacetTagVotes.status} = 'public'))::int AS votes,
               ${mineExpr} AS mine
        FROM ${cardFacetTagVotes}
        WHERE ${cardFacetTagVotes.cardUniqueId} IN (${sql.join(cardUniqueIds.map((c) => sql`${c}`), sql`, `)})
        GROUP BY 1, 2
        HAVING (COUNT(*) FILTER (WHERE ${cardFacetTagVotes.status} = 'public')) > 0${mineHaving}
      `);
      const voteRows = (voteResult as unknown as { rows: any[] }).rows ?? (voteResult as unknown as any[]);

      const byCard = new Map<string, Map<string, CardFacetSummaryTag>>();
      const entry = (id: string, tag: string) => {
        let m = byCard.get(id);
        if (!m) { m = new Map(); byCard.set(id, m); }
        let t = m.get(tag);
        if (!t) { t = { tag, votes: 0, live: false, mine: false }; m.set(tag, t); }
        return t;
      };
      for (const r of liveRows) for (const tag of r.ft) entry(r.id, tag).live = true;
      for (const r of voteRows) {
        const t = entry(r.id, r.tag);
        t.votes = Number(r.votes) || 0;
        t.mine = r.mine === true;
      }

      const data: Record<string, CardFacetSummaryTag[]> = {};
      for (const [id, m] of byCard) {
        data[id] = [...m.values()].sort((a, b) => Number(b.live) - Number(a.live) || b.votes - a.votes || a.tag.localeCompare(b.tag));
      }
      return { success: true, data };
    } catch (error) {
      return fail(error, 'Failed to read facet summary');
    }
  }

  async createSuggestion(input: CreateSuggestionInput): AsyncResult<FacetSuggestionDTO> {
    try {
      if (!DIMENSIONS.includes(input.dim)) {
        return { success: false, error: `dim must be one of: ${DIMENSIONS.join(', ')}` };
      }
      if (!input.label?.trim()) {
        return { success: false, error: 'label is required' };
      }
      const [row] = await db
        .insert(facetTagSuggestions)
        .values({
          id: crypto.randomUUID(),
          proposedId: input.proposedId?.trim() || null,
          dim: input.dim,
          label: input.label.trim(),
          def: input.def?.trim() ?? '',
          rationale: input.rationale?.trim() ?? '',
          proposedBy: input.proposedBy,
        })
        .returning();
      return { success: true, data: toSuggestionDTO(row) };
    } catch (error) {
      return fail(error, 'Failed to create suggestion');
    }
  }

  async listSuggestions(status?: SuggestionStatus): AsyncResult<FacetSuggestionDTO[]> {
    try {
      const rows = status
        ? await db.select().from(facetTagSuggestions).where(eq(facetTagSuggestions.status, status)).orderBy(desc(facetTagSuggestions.createdAt))
        : await db.select().from(facetTagSuggestions).orderBy(desc(facetTagSuggestions.createdAt));
      return { success: true, data: rows.map(toSuggestionDTO) };
    } catch (error) {
      return fail(error, 'Failed to list suggestions');
    }
  }

  async approveSuggestion(id: string, reviewerId: string, overrides?: ApproveSuggestionOverrides): AsyncResult<FacetTagDefinitionDTO> {
    try {
      const [sug] = await db.select().from(facetTagSuggestions).where(eq(facetTagSuggestions.id, id)).limit(1);
      if (!sug) return { success: false, error: 'Suggestion not found' };
      if (sug.status !== 'pending') return { success: false, error: `Suggestion already ${sug.status}` };

      const created = await this.createTagDefinition({
        id: overrides?.id ?? sug.proposedId ?? '',
        dim: (overrides?.dim ?? sug.dim) as FacetDimension,
        label: overrides?.label ?? sug.label,
        def: overrides?.def ?? sug.def,
      });
      if (!created.success) return created;

      await db
        .update(facetTagSuggestions)
        .set({ status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date() })
        .where(eq(facetTagSuggestions.id, id));
      return created;
    } catch (error) {
      return fail(error, 'Failed to approve suggestion');
    }
  }

  async rejectSuggestion(id: string, reviewerId: string): AsyncResult<{ rejected: true }> {
    try {
      const [sug] = await db.select({ status: facetTagSuggestions.status }).from(facetTagSuggestions).where(eq(facetTagSuggestions.id, id)).limit(1);
      if (!sug) return { success: false, error: 'Suggestion not found' };
      if (sug.status !== 'pending') return { success: false, error: `Suggestion already ${sug.status}` };

      await db
        .update(facetTagSuggestions)
        .set({ status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date() })
        .where(eq(facetTagSuggestions.id, id));
      return { success: true, data: { rejected: true } };
    } catch (error) {
      return fail(error, 'Failed to reject suggestion');
    }
  }
}

function toSuggestionDTO(row: typeof facetTagSuggestions.$inferSelect): FacetSuggestionDTO {
  return {
    id: row.id,
    proposedId: row.proposedId,
    dim: row.dim as FacetDimension,
    label: row.label,
    def: row.def,
    rationale: row.rationale,
    proposedBy: row.proposedBy,
    status: row.status as SuggestionStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Recompute cards.facet_tags for ONE card id from the sources of truth:
 * curator assignments (always) ∪ community tags at/above the vote threshold.
 * Only ever writes the facet_tags column. Runs inside the caller's transaction.
 */
async function reproject(tx: any, id: string): Promise<void> {
  await tx.execute(sql`
    UPDATE ${cards} SET facet_tags = COALESCE((
      SELECT array_agg(tag ORDER BY tag) FROM (
        SELECT ${cardFacetTags.tag} AS tag FROM ${cardFacetTags} WHERE ${cardFacetTags.cardUniqueId} = ${id}
        UNION
        SELECT ${cardFacetTagVotes.tag} AS tag FROM ${cardFacetTagVotes}
          WHERE ${cardFacetTagVotes.cardUniqueId} = ${id} AND ${cardFacetTagVotes.status} = 'public'
          GROUP BY ${cardFacetTagVotes.tag}
          HAVING COUNT(DISTINCT ${cardFacetTagVotes.userId}) >= ${COMMUNITY_VOTE_THRESHOLD}
      ) s
    ), ARRAY[]::text[])
    WHERE ${cards.cardUniqueId} = ${id}
  `);
}

function toDTO(row: typeof facetTagDefinitions.$inferSelect): FacetTagDefinitionDTO {
  return { id: row.id, dim: row.dim as FacetDimension, label: row.label, def: row.def, draft: row.draft };
}

function fail(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message : fallback };
}
