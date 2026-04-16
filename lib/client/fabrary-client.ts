// lib/client/fabrary-client.ts
import { handleResponse, handleError } from './utils';
import type { ApiResponse } from './types';
import type {
  FabraryResolveResult,
  FabraryImportResult,
  FabraryInventoryItem,
  FabraryWantsItem,
  FabraryUnresolvedRow,
} from '@/lib/utils/fabrary-csv';

export type { FabraryResolveResult, FabraryImportResult, FabraryInventoryItem, FabraryWantsItem, FabraryUnresolvedRow };

// Step 1: upload CSV, get back resolved printing_ids + unresolved rows
export async function resolveFabraryCollection(file: File): Promise<ApiResponse<FabraryResolveResult>> {
  try {
    const fd = new FormData();
    fd.append('csv', file);
    const response = await fetch('/api/collection/fabrary-import/resolve', {
      method: 'POST',
      body: fd,
    });
    return handleResponse<FabraryResolveResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

// Step 2: send pre-resolved items, create binder and import
export async function importFabraryCollection(
  inventory: FabraryInventoryItem[],
  wants: FabraryWantsItem[],
  unresolved: FabraryUnresolvedRow[]
): Promise<ApiResponse<FabraryImportResult>> {
  try {
    const response = await fetch('/api/collection/fabrary-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory, wants, unresolved }),
    });
    return handleResponse<FabraryImportResult>(response);
  } catch (error) {
    return handleError(error);
  }
}
