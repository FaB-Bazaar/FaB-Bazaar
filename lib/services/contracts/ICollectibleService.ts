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

// ── Crowdsourced submissions ─────────────────────────────────────────────────
// Any signed-in user can propose a NEW catalog entry (collectibleId null) or a
// CORRECTION to an existing one (collectibleId set). Superadmins review:
// approve applies the proposed fields to the catalog; reject just closes the
// row. Reviewed rows are kept for provenance.

export type CollectibleSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface CollectibleSubmissionDTO {
  id: string;
  /** null = new-entry proposal; set = edit suggestion for that catalog entry. */
  collectibleId: string | null;
  /** Current catalog name of the target entry (joined; null for new-entry proposals). */
  collectibleName: string | null;
  userId: string;
  /** Submitter's username (joined; null if the account was deleted). */
  username: string | null;
  kind: CollectibleKind;
  /** Proposed fields — null means "no change proposed" on edit suggestions. */
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  artist: string | null;
  source: string | null;
  year: number | null;
  /** Free-text message to the reviewer; never copied to the catalog. */
  notes: string | null;
  status: CollectibleSubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface CreateCollectibleSubmissionDTO {
  /** Set to suggest an edit to an existing entry; omit to propose a new one. */
  collectibleId?: string;
  kind?: CollectibleKind;
  /** Required for new-entry proposals. */
  name?: string;
  description?: string;
  imageUrl?: string;
  artist?: string;
  source?: string;
  year?: number;
  notes?: string;
}

export interface CollectibleSubmissionFilters {
  status?: CollectibleSubmissionStatus;
  userId?: string;
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

  // Crowdsourced submissions — create is any signed-in user; list/review is admin.
  createSubmission(userId: string, data: CreateCollectibleSubmissionDTO): AsyncResult<CollectibleSubmissionDTO>;
  listSubmissions(filters?: CollectibleSubmissionFilters): AsyncResult<CollectibleSubmissionDTO[]>;
  /** Applies proposed fields to the catalog (create or update) and closes the submission. */
  approveSubmission(submissionId: string, reviewerId: string): AsyncResult<{ collectible: CollectibleDTO }>;
  rejectSubmission(submissionId: string, reviewerId: string): AsyncResult<{ rejected: boolean }>;
}
