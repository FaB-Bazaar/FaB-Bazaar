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
