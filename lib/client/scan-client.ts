// lib/client/scan-client.ts — client wrapper for the card scanner endpoint.
import type { IdentifyResult } from '@/lib/services/postgres/scan/PostgresScanService';
import type { PitchHint } from '@/lib/scan/image-hash';
import type { ApiResponse } from './types';
import { handleResponse, handleError } from './utils';

export interface IdentifiedCard extends IdentifyResult {
  pitchHint: PitchHint | null;
  deskewed: boolean;
  /** Per-card JPEG data URL when the card was found and deskewed in the photo. */
  thumb: string | null;
  sessionItemId?: string;
  /** Server-side capture id of the photo (label it with labelCapture). */
  captureId?: string;
}
/** `data` is the first card (compatibility); `cards` holds every card found in the photo, in reading order. */
export type IdentifyResponse = IdentifiedCard & { cards: IdentifiedCard[] };

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

export interface ScanSessionInfo { code: string; pairUrl: string; expiresInSec: number }

/** Desktop: open a phone-pairing session (render pairUrl as a QR). */
export async function createSession(): Promise<ApiResponse<ScanSessionInfo>> {
  try {
    const response = await fetch('/api/scan/session', { method: 'POST' });
    return await handleResponse<ScanSessionInfo>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Phone: announce that it joined the desktop's session. 403/404 = wrong account / expired. */
export async function pairSession(code: string): Promise<ApiResponse<{ code: string; paired: boolean }>> {
  try {
    const response = await fetch(`/api/scan/session/${encodeURIComponent(code)}/pair`, { method: 'POST' });
    return await handleResponse<{ code: string; paired: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Phone: identify AND push the result into the paired desktop's session. */
export async function identifyCardForSession(image: Blob, session: string, limit = 5): Promise<ApiResponse<IdentifyResponse & { sessionItemId?: string }>> {
  try {
    const fd = new FormData();
    fd.append('image', image, 'card.jpg');
    fd.append('limit', String(limit));
    fd.append('session', session);
    const response = await fetch('/api/scan/identify', { method: 'POST', body: fd });
    return await handleResponse<IdentifyResponse & { sessionItemId?: string }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Desktop: SSE URL for a session's live events. */
export function sessionEventsUrl(code: string): string {
  return `/api/scan/session/${encodeURIComponent(code)}/events`;
}

/** Tell the server what a scanned photo really was ('corrected' = picked via search, 'accepted' = added as suggested). */
export async function labelCapture(captureId: string, printingId: string, source: 'corrected' | 'accepted'): Promise<ApiResponse<{ captureId: string }>> {
  try {
    const response = await fetch('/api/scan/captures/label', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captureId, printingId, source }) });
    return await handleResponse<{ captureId: string }>(response);
  } catch (error) {
    return handleError(error);
  }
}
