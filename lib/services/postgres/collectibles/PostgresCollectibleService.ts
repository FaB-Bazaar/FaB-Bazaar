/**
 * PostgreSQL implementation of Collectible Service
 *
 * Catalog of non-card collectibles (playmats first) + per-user have/want marks.
 * Counts are aggregated with filtered COUNTs over user_collectible_marks;
 * the viewer's own mark is resolved with a MAX(...) FILTER on their user id.
 */

import { eq, and, sql, asc, ilike } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { collectibles, userCollectibleMarks } from '@/lib/postgres/schema';
import type {
  ICollectibleService,
  CollectibleDTO,
  CreateCollectibleDTO,
  UpdateCollectibleDTO,
  CollectibleFilters,
  CollectibleKind,
  CollectibleMarkStatus,
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
