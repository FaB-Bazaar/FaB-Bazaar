import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { collectibleService } from '@/lib/services';
import type { CollectibleFilters, CollectibleKind } from '@/lib/services/contracts/ICollectibleService';

/**
 * GET /api/collectibles — public catalog list (playmats first).
 *
 * Auth is OPTIONAL: anonymous callers get the catalog with aggregate counts;
 * authenticated callers additionally get their own have/want mark
 * (viewerStatus) resolved per item.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  const viewerId = authResult.success && authResult.userId ? authResult.userId : null;

  const { searchParams } = new URL(request.url);
  const filters: CollectibleFilters = {};
  const kind = searchParams.get('kind');
  if (kind) filters.kind = kind as CollectibleKind;
  const year = searchParams.get('year');
  if (year && !Number.isNaN(Number(year))) filters.year = Number(year);
  const artist = searchParams.get('artist');
  if (artist) filters.artist = artist;
  const search = searchParams.get('search');
  if (search) filters.search = search;

  const result = await collectibleService.listCollectibles(filters, viewerId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
