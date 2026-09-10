// lib/client/scan-client.ts — client wrapper for the card scanner endpoint.
import type { IdentifyResult } from '@/lib/services/postgres/scan/PostgresScanService';
import type { PitchHint } from '@/lib/scan/image-hash';
import type { ApiResponse } from './types';
import { handleResponse, handleError } from './utils';

export type IdentifyResponse = IdentifyResult & { pitchHint: PitchHint | null };

/** POST one card photo (already downscaled client-side) and get ranked candidates. */
export async function identifyCard(image: Blob, limit = 5): Promise<ApiResponse<IdentifyResponse>> {
  try {
    const fd = new FormData();
    fd.append('image', image, 'card.jpg');
    fd.append('limit', String(limit));
    const response = await fetch('/api/scan/identify', { method: 'POST', body: fd });
    return await handleResponse<IdentifyResponse>(response);
  } catch (error) {
    return handleError(error);
  }
}
