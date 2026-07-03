// app/api/printings/[printingId]/route.ts
// Public printing lookup by primary key. Used by QR-scan clients (webcam
// play, sticker scans) to resolve a printing id to card identity when the
// card isn't in a preloaded decklist. Printing identity is immutable, so
// hits are cacheable forever (Caddy and browsers absorb repeats).
import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';

const PRINTING_ID_RE = /^[A-Za-z0-9_-]{21}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ printingId: string }> }
) {
  const { printingId } = await params;

  if (!PRINTING_ID_RE.test(printingId)) {
    return NextResponse.json({ error: 'Invalid printing id' }, { status: 400 });
  }

  const result = await printingsService.getPrintingById(printingId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: 'Printing not found' }, { status: 404 });
  }

  return NextResponse.json(
    { success: true, data: result.data },
    { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
  );
}
