import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';
import { displayUsername } from '@/lib/utils/display-username';

const CO_OWNER_MAX = 20;

// GET /api/decks/[deckId]/co-owners
// Returns co-owner profiles. Accessible by the primary owner or any co-owner.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId } = await params;

    const deckLookup = await deckService.findByPublicId(publicId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    const deck = deckLookup.data;
    const isOwner = deck.userId === authResult.userId;
    const isCoOwner = (deck.coOwners ?? []).includes(authResult.userId!);

    if (!isOwner && !isCoOwner) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const coOwnerIds = deck.coOwners ?? [];
    if (coOwnerIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const usersResult = await userService.getUsersByIds(coOwnerIds);
    if (!usersResult.success) {
      return NextResponse.json({ success: false, error: usersResult.error }, { status: 500 });
    }

    const coOwners = usersResult.data.map((u) => ({
      id: u._id,
      username: displayUsername(u.username),
      avatar: u.avatarUrl || null,
    }));

    return NextResponse.json({ success: true, data: coOwners });
  } catch (error) {
    console.error('[CoOwners GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/decks/[deckId]/co-owners
// Replaces the full co-owners list. Primary owner only.
// Body: { userIds: string[] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId } = await params;
    const body = await request.json();
    const { userIds } = body as { userIds: string[] };

    if (!Array.isArray(userIds)) {
      return NextResponse.json({ success: false, error: 'userIds must be an array' }, { status: 400 });
    }

    if (userIds.length > CO_OWNER_MAX) {
      return NextResponse.json(
        { success: false, error: `A deck can have at most ${CO_OWNER_MAX} co-owners` },
        { status: 400 }
      );
    }

    // Verify caller is the primary owner
    const deckLookup = await deckService.findByPublicId(publicId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    if (deckLookup.data.userId !== authResult.userId) {
      return NextResponse.json({ success: false, error: 'Only the deck owner can manage co-owners' }, { status: 403 });
    }

    // Prevent the owner from adding themselves as a co-owner
    const safeIds = userIds.filter(id => id !== authResult.userId);

    const result = await deckService.updateCoOwners(publicId, authResult.userId!, safeIds);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { coOwnerCount: safeIds.length },
    });
  } catch (error) {
    console.error('[CoOwners PUT] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
