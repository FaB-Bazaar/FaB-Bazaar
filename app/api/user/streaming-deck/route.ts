// GET/PUT /api/user/streaming-deck — the deck a user's profile-level stream overlay
// (/overlay/u/<username>/deck) shows. PUT { deckPublicId: string | null }; null clears.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';

async function overlayPath(userId: string): Promise<string | null> {
  const user = await userService.findById(userId);
  const username = user.success ? user.data?.username : undefined;
  return username ? `/overlay/u/${encodeURIComponent(username)}/deck` : null;
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error ?? 'Not authenticated' }, { status: 401 });
  }

  const result = await deckService.getStreamingDeckPublicId(authResult.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: { deckPublicId: result.data, overlayPath: await overlayPath(authResult.userId) },
  });
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error ?? 'Not authenticated' }, { status: 401 });
  }

  const deckPublicId = (body as { deckPublicId?: unknown } | null)?.deckPublicId;
  if (deckPublicId !== null && typeof deckPublicId !== 'string') {
    return NextResponse.json({ error: 'deckPublicId must be a string or null' }, { status: 400 });
  }

  const result = await deckService.setStreamingDeck(authResult.userId, deckPublicId);
  if (!result.success) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'NOT_STREAMABLE' ? 422 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
