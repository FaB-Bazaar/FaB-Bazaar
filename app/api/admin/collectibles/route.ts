import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from './_auth';
import { collectibleService } from '@/lib/services';
import type { CreateCollectibleDTO } from '@/lib/services/contracts/ICollectibleService';

/**
 * POST /api/admin/collectibles — create a catalog entry (superadmin only).
 */
export async function POST(request: NextRequest) {
  let body: Partial<CreateCollectibleDTO> = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const result = await collectibleService.createCollectible(
    {
      kind: body.kind,
      name: body.name.trim(),
      description: body.description,
      imageUrl: body.imageUrl,
      artist: body.artist,
      source: body.source,
      year: body.year,
    },
    gate.userId,
  );
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
