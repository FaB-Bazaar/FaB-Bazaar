// app/api/decks/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from '@/auth';
import { deckService, userService } from '@/lib/services';
import { displayUsername } from '@/lib/utils/display-username';

export async function GET(request: NextRequest) {
  console.log('[API TRACK] /api/decks/user called at', new Date().toISOString());
  try {
    // Get user session
    const session = await auth();
    if (!session || !session.user.id) {
      return NextResponse.json({
        success: false,
        decks: [],
        error: "Authentication required"
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : null;
    const talisharOnly = searchParams.get('talishar') === 'true';
    const pinnedOnly = searchParams.get('pinned') === 'true';

    // Use service layer to fetch decks (lightweight version)
    const result = await deckService.listUserDecksBasic(session.user.id);

    if (!result.success) {
      console.error('[UserDecks] Error fetching user decks:', result.error);
      return NextResponse.json(
        {
          success: false,
          decks: [],
          hasPinned: false,
          error: 'Failed to fetch decks'
        },
        { status: 500 }
      );
    }

    const hasPinned = result.data.some(d => d.pinnedInNav === true);

    let decks = talisharOnly
      ? result.data.filter(d => d.availableOnTalishar)
      : result.data;
    // Pinned filter: only restrict to pinned when the user actually has at least one
    // pinned deck. Without this fallback, a brand-new user's navbar would be empty.
    if (pinnedOnly && hasPinned) {
      decks = decks.filter(d => d.pinnedInNav === true);
    }
    decks = limit ? decks.slice(0, limit) : decks;

    // Bulk-fetch owner usernames for co-owned decks
    const coOwnedUserIds = [...new Set(decks.filter(d => d.isCoOwned).map(d => d.userId))];
    if (coOwnedUserIds.length > 0) {
      const ownersResult = await userService.getUsersByIds(coOwnedUserIds);
      if (ownersResult.success) {
        const ownerMap = new Map(ownersResult.data.map(u => [u._id, displayUsername(u.username)]));
        decks = decks.map(d => d.isCoOwned ? { ...d, ownerUsername: ownerMap.get(d.userId) } : d);
      }
    }

    // When the navbar requests pinned-mode the response must be fresh — it
    // changes the instant a user pins/unpins.
    const cacheControl = pinnedOnly
      ? 'private, no-store'
      : 'private, max-age=60, stale-while-revalidate=120';

    return NextResponse.json(
      {
        success: true,
        decks,
        count: decks.length,
        hasPinned,
      },
      { headers: { 'Cache-Control': cacheControl } }
    );

  } catch (error) {
    console.error('[UserDecks] Error fetching user decks:', error);
    return NextResponse.json(
      {
        success: false,
        decks: [],
        error: 'Failed to fetch decks'
      },
      { status: 500 }
    );
  }
}
