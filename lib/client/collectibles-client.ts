/**
 * Collectibles Client Service
 *
 * Client-side wrapper for /api/collectibles — the global collectible catalog
 * (playmats first) and the caller's have/want marks.
 */

import type { ApiResponse } from './types';
import { handleResponse, handleError, buildQueryParams } from './utils';
import type {
  CollectibleDTO,
  CollectibleFilters,
  CollectibleMarkStatus,
  CollectibleSubmissionDTO,
  CollectibleSubmissionStatus,
  CreateCollectibleSubmissionDTO,
} from '@/lib/services/contracts/ICollectibleService';

/**
 * List the catalog. Public: works signed-out (no viewer marks); signed-in
 * callers get their own viewerStatus per item.
 */
export async function listCollectibles(
  filters: CollectibleFilters = {},
): Promise<ApiResponse<CollectibleDTO[]>> {
  try {
    const params = buildQueryParams(filters as Record<string, unknown>);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/collectibles${qs}`, {
      credentials: 'include',
    });
    return handleResponse<CollectibleDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Set (upsert) the caller's have/want mark on a collectible. */
export async function setMark(
  collectibleId: string,
  status: CollectibleMarkStatus,
): Promise<ApiResponse<{ status: CollectibleMarkStatus }>> {
  try {
    const response = await fetch(`/api/collectibles/${collectibleId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    return handleResponse<{ status: CollectibleMarkStatus }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Suggest a new collectible (no collectibleId) or a correction to an existing
 * one (collectibleId set). Signed-in users only; lands in the admin review queue.
 */
export async function submitSuggestion(
  data: CreateCollectibleSubmissionDTO,
): Promise<ApiResponse<CollectibleSubmissionDTO>> {
  try {
    const response = await fetch('/api/collectibles/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<CollectibleSubmissionDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ── Admin (superadmin-gated routes) ─────────────────────────────────────────

import type {
  CreateCollectibleDTO,
  UpdateCollectibleDTO,
} from '@/lib/services/contracts/ICollectibleService';

/** Create a catalog entry (superadmin). */
export async function adminCreate(
  data: CreateCollectibleDTO,
): Promise<ApiResponse<CollectibleDTO>> {
  try {
    const response = await fetch('/api/admin/collectibles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<CollectibleDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Update a catalog entry (superadmin). */
export async function adminUpdate(
  collectibleId: string,
  data: UpdateCollectibleDTO,
): Promise<ApiResponse<CollectibleDTO>> {
  try {
    const response = await fetch(`/api/admin/collectibles/${collectibleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<CollectibleDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Delete a catalog entry (superadmin). Marks cascade. */
export async function adminDelete(
  collectibleId: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const response = await fetch(`/api/admin/collectibles/${collectibleId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ deleted: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** List crowdsourced submissions for review (superadmin). Default: pending. */
export async function adminListSubmissions(
  status: CollectibleSubmissionStatus | 'all' = 'pending',
): Promise<ApiResponse<CollectibleSubmissionDTO[]>> {
  try {
    const response = await fetch(`/api/admin/collectibles/submissions?status=${status}`, {
      credentials: 'include',
    });
    return handleResponse<CollectibleSubmissionDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Approve or reject a submission (superadmin). Approve applies it to the catalog. */
export async function adminReviewSubmission(
  submissionId: string,
  action: 'approve' | 'reject',
): Promise<ApiResponse<{ collectible?: CollectibleDTO; rejected?: boolean }>> {
  try {
    const response = await fetch(`/api/admin/collectibles/submissions/${submissionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action }),
    });
    return handleResponse<{ collectible?: CollectibleDTO; rejected?: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Clear the caller's mark on a collectible. */
export async function clearMark(
  collectibleId: string,
): Promise<ApiResponse<{ cleared: boolean }>> {
  try {
    const response = await fetch(`/api/collectibles/${collectibleId}/mark`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ cleared: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}
