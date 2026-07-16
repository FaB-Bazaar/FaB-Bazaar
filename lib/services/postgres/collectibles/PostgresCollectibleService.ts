/**
 * PostgreSQL implementation of Collectible Service
 *
 * Catalog of non-card collectibles (playmats first) + per-user have/want marks.
 * Counts are aggregated with filtered COUNTs over user_collectible_marks;
 * the viewer's own mark is resolved with a MAX(...) FILTER on their user id.
 */

import { eq, and, sql, asc, desc, ilike, count } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { collectibles, collectibleSubmissions, userCollectibleMarks, users } from '@/lib/postgres/schema';
import type {
  ICollectibleService,
  CollectibleDTO,
  CreateCollectibleDTO,
  UpdateCollectibleDTO,
  CollectibleFilters,
  CollectibleKind,
  CollectibleMarkStatus,
  CollectibleSubmissionDTO,
  CollectibleSubmissionFilters,
  CollectibleSubmissionStatus,
  CreateCollectibleSubmissionDTO,
} from '@/lib/services/contracts/ICollectibleService';
import type { AsyncResult } from '@/lib/services/contracts/common';

export class PostgresCollectibleService implements ICollectibleService {
  async listCollectibles(filters?: CollectibleFilters, viewerId?: string | null): AsyncResult<CollectibleDTO[]> {
    try {
      const conditions = [];
      if (filters?.kind) conditions.push(eq(collectibles.kind, filters.kind));
      if (filters?.year !== undefined) conditions.push(eq(collectibles.year, filters.year));
      if (filters?.artist) conditions.push(ilike(collectibles.artist, filters.artist));
      if (filters?.search) conditions.push(ilike(collectibles.name, `%${filters.search}%`));

      const rows = await db
        .select(this.buildSelectFields(viewerId))
        .from(collectibles)
        .leftJoin(userCollectibleMarks, eq(userCollectibleMarks.collectibleId, collectibles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(collectibles.id)
        .orderBy(asc(collectibles.year), asc(collectibles.name));

      return { success: true, data: rows.map((r) => this.mapToDTO(r)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list collectibles' };
    }
  }

  async getCollectible(id: string, viewerId?: string | null): AsyncResult<CollectibleDTO | null> {
    try {
      const rows = await db
        .select(this.buildSelectFields(viewerId))
        .from(collectibles)
        .leftJoin(userCollectibleMarks, eq(userCollectibleMarks.collectibleId, collectibles.id))
        .where(eq(collectibles.id, id))
        .groupBy(collectibles.id)
        .limit(1);

      if (rows.length === 0) return { success: true, data: null };
      return { success: true, data: this.mapToDTO(rows[0]) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get collectible' };
    }
  }

  async createCollectible(data: CreateCollectibleDTO, createdBy: string): AsyncResult<CollectibleDTO> {
    try {
      const [row] = await db
        .insert(collectibles)
        .values({
          id: crypto.randomUUID(),
          kind: data.kind ?? 'playmat',
          name: data.name,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          artist: data.artist ?? null,
          source: data.source ?? null,
          year: data.year ?? null,
          createdBy,
        })
        .returning();

      const created = await this.getCollectible(row.id);
      if (!created.success || !created.data) {
        return { success: false, error: 'Failed to read back created collectible' };
      }
      return { success: true, data: created.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create collectible' };
    }
  }

  async updateCollectible(id: string, data: UpdateCollectibleDTO): AsyncResult<CollectibleDTO> {
    try {
      const [row] = await db
        .update(collectibles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(collectibles.id, id))
        .returning();

      if (!row) return { success: false, error: 'Collectible not found' };

      const updated = await this.getCollectible(id);
      if (!updated.success || !updated.data) {
        return { success: false, error: 'Failed to read back updated collectible' };
      }
      return { success: true, data: updated.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update collectible' };
    }
  }

  async deleteCollectible(id: string): AsyncResult<{ deleted: boolean }> {
    try {
      const deleted = await db.delete(collectibles).where(eq(collectibles.id, id)).returning({ id: collectibles.id });
      if (deleted.length === 0) return { success: false, error: 'Collectible not found' };
      return { success: true, data: { deleted: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete collectible' };
    }
  }

  async setMark(userId: string, collectibleId: string, status: CollectibleMarkStatus): AsyncResult<{ status: CollectibleMarkStatus }> {
    try {
      await db
        .insert(userCollectibleMarks)
        .values({ id: crypto.randomUUID(), userId, collectibleId, status })
        .onConflictDoUpdate({
          target: [userCollectibleMarks.userId, userCollectibleMarks.collectibleId],
          set: { status, updatedAt: new Date() },
        });

      return { success: true, data: { status } };
    } catch (error) {
      // FK violation (23503) means the collectible (or user) row doesn't exist.
      // Drizzle wraps the pg error, so the code may live on error.cause.
      const pgCode =
        (error as { code?: string })?.code ??
        ((error as { cause?: { code?: string } })?.cause?.code);
      if (pgCode === '23503') {
        return { success: false, error: 'Collectible not found' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set mark' };
    }
  }

  async clearMark(userId: string, collectibleId: string): AsyncResult<{ cleared: boolean }> {
    try {
      await db
        .delete(userCollectibleMarks)
        .where(and(eq(userCollectibleMarks.userId, userId), eq(userCollectibleMarks.collectibleId, collectibleId)));

      return { success: true, data: { cleared: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clear mark' };
    }
  }

  // ── Crowdsourced submissions ───────────────────────────────────────────────

  /** Spam guard: a user may have at most this many open submissions at once. */
  private static readonly MAX_PENDING_SUBMISSIONS_PER_USER = 10;

  async createSubmission(userId: string, data: CreateCollectibleSubmissionDTO): AsyncResult<CollectibleSubmissionDTO> {
    try {
      const proposedFields = [data.name, data.description, data.imageUrl, data.artist, data.source, data.year];
      if (data.collectibleId) {
        if (proposedFields.every((f) => f == null) && !data.notes?.trim()) {
          return { success: false, error: 'Suggest at least one change or add a note' };
        }
        const target = await db
          .select({ id: collectibles.id })
          .from(collectibles)
          .where(eq(collectibles.id, data.collectibleId))
          .limit(1);
        if (target.length === 0) return { success: false, error: 'Collectible not found' };
      } else if (!data.name?.trim()) {
        return { success: false, error: 'Name is required for new collectible suggestions' };
      }

      const [{ pendingCount }] = await db
        .select({ pendingCount: count() })
        .from(collectibleSubmissions)
        .where(and(eq(collectibleSubmissions.userId, userId), eq(collectibleSubmissions.status, 'pending')));
      if (pendingCount >= PostgresCollectibleService.MAX_PENDING_SUBMISSIONS_PER_USER) {
        return { success: false, error: 'You have too many pending submissions — please wait for review' };
      }

      const [row] = await db
        .insert(collectibleSubmissions)
        .values({
          id: crypto.randomUUID(),
          collectibleId: data.collectibleId ?? null,
          userId,
          kind: data.kind ?? 'playmat',
          name: data.name?.trim() || null,
          description: data.description?.trim() || null,
          imageUrl: data.imageUrl?.trim() || null,
          artist: data.artist?.trim() || null,
          source: data.source?.trim() || null,
          year: data.year ?? null,
          notes: data.notes?.trim() || null,
        })
        .returning();

      const read = await this.listSubmissions({ status: 'pending' });
      const dto = read.success ? read.data.find((s) => s.id === row.id) : undefined;
      if (!dto) return { success: false, error: 'Failed to read back created submission' };
      return { success: true, data: dto };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create submission' };
    }
  }

  async listSubmissions(filters?: CollectibleSubmissionFilters): AsyncResult<CollectibleSubmissionDTO[]> {
    try {
      const conditions = [];
      if (filters?.status) conditions.push(eq(collectibleSubmissions.status, filters.status));
      if (filters?.userId) conditions.push(eq(collectibleSubmissions.userId, filters.userId));

      const rows = await db
        .select({
          submission: collectibleSubmissions,
          username: users.username,
          collectibleName: collectibles.name,
        })
        .from(collectibleSubmissions)
        .leftJoin(users, eq(users.id, collectibleSubmissions.userId))
        .leftJoin(collectibles, eq(collectibles.id, collectibleSubmissions.collectibleId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(collectibleSubmissions.createdAt));

      return {
        success: true,
        data: rows.map(({ submission, username, collectibleName }) => ({
          id: submission.id,
          collectibleId: submission.collectibleId,
          collectibleName,
          userId: submission.userId,
          username,
          kind: submission.kind as CollectibleKind,
          name: submission.name,
          description: submission.description,
          imageUrl: submission.imageUrl,
          artist: submission.artist,
          source: submission.source,
          year: submission.year,
          notes: submission.notes,
          status: submission.status as CollectibleSubmissionStatus,
          reviewedBy: submission.reviewedBy,
          reviewedAt: submission.reviewedAt,
          createdAt: submission.createdAt,
        })),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list submissions' };
    }
  }

  async approveSubmission(submissionId: string, reviewerId: string): AsyncResult<{ collectible: CollectibleDTO }> {
    try {
      const [submission] = await db
        .select()
        .from(collectibleSubmissions)
        .where(eq(collectibleSubmissions.id, submissionId))
        .limit(1);
      if (!submission) return { success: false, error: 'Submission not found' };
      if (submission.status !== 'pending') return { success: false, error: 'Submission already reviewed' };

      let applied: { success: true; data: CollectibleDTO } | { success: false; error: string };
      if (submission.collectibleId) {
        // Edit suggestion: apply only the fields the submitter actually proposed.
        const changes: UpdateCollectibleDTO = {};
        if (submission.name != null) changes.name = submission.name;
        if (submission.description != null) changes.description = submission.description;
        if (submission.imageUrl != null) changes.imageUrl = submission.imageUrl;
        if (submission.artist != null) changes.artist = submission.artist;
        if (submission.source != null) changes.source = submission.source;
        if (submission.year != null) changes.year = submission.year;
        applied = Object.keys(changes).length > 0
          ? await this.updateCollectible(submission.collectibleId, changes)
          : await (async () => {
              // Notes-only submission: nothing to apply, but approval still closes it.
              const existing = await this.getCollectible(submission.collectibleId!);
              if (!existing.success) return existing;
              if (!existing.data) return { success: false as const, error: 'Collectible not found' };
              return { success: true as const, data: existing.data };
            })();
      } else {
        if (!submission.name) return { success: false, error: 'Submission has no name' };
        applied = await this.createCollectible(
          {
            kind: submission.kind as CollectibleKind,
            name: submission.name,
            description: submission.description ?? undefined,
            imageUrl: submission.imageUrl ?? undefined,
            artist: submission.artist ?? undefined,
            source: submission.source ?? undefined,
            year: submission.year ?? undefined,
          },
          submission.userId,
        );
      }
      if (!applied.success) return applied;

      await db
        .update(collectibleSubmissions)
        .set({ status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(collectibleSubmissions.id, submissionId));

      return { success: true, data: { collectible: applied.data } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to approve submission' };
    }
  }

  async rejectSubmission(submissionId: string, reviewerId: string): AsyncResult<{ rejected: boolean }> {
    try {
      const updated = await db
        .update(collectibleSubmissions)
        .set({ status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(collectibleSubmissions.id, submissionId), eq(collectibleSubmissions.status, 'pending')))
        .returning({ id: collectibleSubmissions.id });

      if (updated.length === 0) {
        const [existing] = await db
          .select({ id: collectibleSubmissions.id })
          .from(collectibleSubmissions)
          .where(eq(collectibleSubmissions.id, submissionId))
          .limit(1);
        return { success: false, error: existing ? 'Submission already reviewed' : 'Submission not found' };
      }
      return { success: true, data: { rejected: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reject submission' };
    }
  }

  private buildSelectFields(viewerId?: string | null) {
    return {
      id: collectibles.id,
      kind: collectibles.kind,
      name: collectibles.name,
      description: collectibles.description,
      imageUrl: collectibles.imageUrl,
      artist: collectibles.artist,
      source: collectibles.source,
      year: collectibles.year,
      createdAt: collectibles.createdAt,
      updatedAt: collectibles.updatedAt,
      haveCount: sql<number>`count(*) filter (where ${userCollectibleMarks.status} = 'have')`.mapWith(Number),
      wantCount: sql<number>`count(*) filter (where ${userCollectibleMarks.status} = 'want')`.mapWith(Number),
      viewerStatus: viewerId
        ? sql<string | null>`max(${userCollectibleMarks.status}::text) filter (where ${userCollectibleMarks.userId} = ${viewerId})`
        : sql<string | null>`null`,
    };
  }

  private mapToDTO(row: {
    id: string;
    kind: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    artist: string | null;
    source: string | null;
    year: number | null;
    createdAt: Date;
    updatedAt: Date;
    haveCount: number;
    wantCount: number;
    viewerStatus: string | null;
  }): CollectibleDTO {
    return {
      id: row.id,
      kind: row.kind as CollectibleKind,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      artist: row.artist,
      source: row.source,
      year: row.year,
      haveCount: row.haveCount,
      wantCount: row.wantCount,
      viewerStatus: (row.viewerStatus as CollectibleMarkStatus | null) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
