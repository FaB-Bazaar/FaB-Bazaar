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

    // Use service layer to fetch decks (lightweight version)
    const result = await deckService.listUserDecksBasic(session.user.id);

    if (!result.success) {
      console.error('[UserDecks] Error fetching user decks:', result.error);
      return NextResponse.json(
        {
          success: false,
          decks: [],
          error: 'Failed to fetch decks'
        },
        { status: 500 }
      );
    }

    let decks = limit ? result.data.slice(0, limit) : result.data;

    // Bulk-fetch owner usernames for co-owned decks
    const coOwnedUserIds = [...new Set(decks.filter(d => d.isCoOwned).map(d => d.userId))];
    if (coOwnedUserIds.length > 0) {
      const ownersResult = await userService.getUsersByIds(coOwnedUserIds);
      if (ownersResult.success) {
        const ownerMap = new Map(ownersResult.data.map(u => [u._id, displayUsername(u.username)]));
        decks = decks.map(d => d.isCoOwned ? { ...d, ownerUsername: ownerMap.get(d.userId) } : d);
      }
    }

    return NextResponse.json(
      {
        success: true,
        decks,
        count: decks.length
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        }
      }
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
