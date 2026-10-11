// lib/client/scan-client.ts — client wrapper for card-scanner phone pairing (the cards themselves are read in the
// browser: components/scan/useBannerScanner).
import type { ApiResponse } from './types';
import { handleResponse, handleError } from './utils';

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

/** What a paired phone sends per card it read (on the phone): see parseSessionItems in lib/scan/session-store. */
export interface SessionCardResult { name: string; status: 'ok' | 'check'; pitch: number | null; pitchOptions: Array<number | null>; crop: string | null }

/** Phone: send the cards it read to the paired desktop's session. */
export async function sendSessionItems(code: string, items: SessionCardResult[]): Promise<ApiResponse<{ added: number }>> {
  try {
    const response = await fetch(`/api/scan/session/${encodeURIComponent(code)}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
    });
    return await handleResponse<{ added: number }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/** Desktop: SSE URL for a session's live events. */
export function sessionEventsUrl(code: string): string {
  return `/api/scan/session/${encodeURIComponent(code)}/events`;
}

/** Tell the server what a scanned photo really was ('corrected' = picked via search, 'accepted' = added as suggested). */
