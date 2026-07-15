/**
 * Collectible Service Contract
 *
 * Global admin-curated catalog of non-card collectibles (playmats first,
 * extensible via `kind`) plus per-user have/want marks. Deliberately separate
 * from binders/inventory: no printing FK, no condition/pricing machinery.
 */

import type { AsyncResult } from './common';

export type CollectibleKind = 'playmat';

export type CollectibleMarkStatus = 'have' | 'want';

export interface CollectibleDTO {
  id: string;
  kind: CollectibleKind;
  name: string;
  description: string | null;
  imageUrl: string | null;
  artist: string | null;
  /** Where it was made available (event promo, armory kit, store, …). Free text. */
  source: string | null;
  year: number | null;
  /** Aggregate marks across all users. */
  haveCount: number;
  wantCount: number;
  /** The requesting viewer's own mark, when a viewerId was provided. */
  viewerStatus: CollectibleMarkStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCollectibleDTO {
  kind?: CollectibleKind;
  name: string;
  description?: string;
  imageUrl?: string;
  artist?: string;
  source?: string;
  year?: number;
}

export interface UpdateCollectibleDTO {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  artist?: string | null;
  source?: string | null;
  year?: number | null;
}

export interface CollectibleFilters {
  kind?: CollectibleKind;
  year?: number;
  artist?: string;
  /** Case-insensitive substring match on name. */
  search?: string;
}

export interface ICollectibleService {
  listCollectibles(filters?: CollectibleFilters, viewerId?: string | null): AsyncResult<CollectibleDTO[]>;
  getCollectible(id: string, viewerId?: string | null): AsyncResult<CollectibleDTO | null>;

  // Admin catalog management
  createCollectible(data: CreateCollectibleDTO, createdBy: string): AsyncResult<CollectibleDTO>;
  updateCollectible(id: string, data: UpdateCollectibleDTO): AsyncResult<CollectibleDTO>;
  deleteCollectible(id: string): AsyncResult<{ deleted: boolean }>;

  // User marks — at most one mark per (user, collectible); setMark upserts.
  setMark(userId: string, collectibleId: string, status: CollectibleMarkStatus): AsyncResult<{ status: CollectibleMarkStatus }>;
  clearMark(userId: string, collectibleId: string): AsyncResult<{ cleared: boolean }>;
}
