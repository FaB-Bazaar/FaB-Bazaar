/**
 * Daily Movers Client Service
 *
 * Client-side wrapper for /api/daily.
 */

import type { ApiResponse } from './types';
import { handleResponse, handleError, buildQueryParams } from './utils';
import type { MoversInCollectionDTO } from '@/lib/services/contracts/IDailyMoversService';

/**
 * Fetch the current user's daily movers (printings in their inventory that
 * appeared in the latest daily_movers snapshot).
 */
export async function getMyMovers(
  asOf?: string,
): Promise<ApiResponse<MoversInCollectionDTO>> {
  try {
    const qs = asOf ? `?${buildQueryParams({ asOf }).toString()}` : '';
    const response = await fetch(`/api/daily${qs}`, {
      credentials: 'include',
    });
    return handleResponse<MoversInCollectionDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}
