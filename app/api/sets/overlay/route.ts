import { NextResponse } from 'next/server';
import { getSetOverlay } from '@/lib/fab-constants/set-overlay-server';

/**
 * GET /api/sets/overlay — public. The runtime set overlay (sets registered or
 * changed in the DB since the compiled snapshot; lib/fab-constants/
 * set-overlay.ts). SetOverlayProvider fetches it once per tab so pages built
 * before a registration still learn about the new set. No user data.
 */
export async function GET() {
  const overlay = await getSetOverlay();
  return NextResponse.json(
    { success: true, data: overlay },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
