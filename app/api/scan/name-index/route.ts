// GET /api/scan/name-index — the card-name vocabulary the in-browser banner scanner matches OCR text against
// (lib/scan/banner/name-match.ts). Public on purpose: card names, pitches and translations are public data (every
// search exposes them) and the scanner's phone side may not be signed in. Cached; changes only when sets do.
import { NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';

export async function GET() {
  const result = await printingsService.getScanNameIndex();
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(
    { success: true, data: { entries: result.data } },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
  );
}
