import { NextRequest, NextResponse } from 'next/server';
import { curatedListService } from '@/lib/services';

// GET /api/curated-lists/heroes?format= — heroes that have published kit
// lists in a format, with per-hero stats. Public read (published data only,
// same visibility as the /kits pages) — feeds the Volzar "Hero kit" picker.
export async function GET(request: NextRequest) {
  try {
    const format = new URL(request.url).searchParams.get('format')?.trim() || 'Classic Constructed';
    const result = await curatedListService.getHeroSummaries(format);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
