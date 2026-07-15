import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { collectibleService } from '@/lib/services';

/**
 * POST /api/collectibles/[collectibleId]/mark — set the caller's have/want
 * mark (upsert: posting 'want' over 'have' flips it).
 * DELETE — clear the caller's mark.
 *
 * allowOAuth so OAuth 2.1 / MCP clients (Volzar) can call it, not just
 * session users.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collectibleId: string }> },
) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const status = (body as { status?: string })?.status;
  if (status !== 'have' && status !== 'want') {
    return NextResponse.json({ error: "status must be 'have' or 'want'" }, { status: 400 });
  }

  const { collectibleId } = await params;
  const result = await collectibleService.setMark(authResult.userId, collectibleId, status);
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
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { collectibleId } = await params;
  const result = await collectibleService.clearMark(authResult.userId, collectibleId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
