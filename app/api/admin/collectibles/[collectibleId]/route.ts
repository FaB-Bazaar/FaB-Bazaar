import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { collectibleService } from '@/lib/services';
import type { UpdateCollectibleDTO } from '@/lib/services/contracts/ICollectibleService';

/**
 * PATCH /api/admin/collectibles/[collectibleId] — update a catalog entry.
 * DELETE — remove it (marks cascade). Superadmin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collectibleId: string }> },
) {
  let body: UpdateCollectibleDTO = {};
  try {
    body = await request.json();
  } catch {
    // empty body → no-op update, rejected by validation below
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  const { collectibleId } = await params;
  const result = await collectibleService.updateCollectible(collectibleId, body);
  if (!result.success) {
    const code = result.error === 'Collectible not found' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status: code });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collectibleId: string }> },
) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;

  const { collectibleId } = await params;
  const result = await collectibleService.deleteCollectible(collectibleId);
  if (!result.success) {
    const code = result.error === 'Collectible not found' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status: code });
  }

  return NextResponse.json({ success: true, data: result.data });
}
