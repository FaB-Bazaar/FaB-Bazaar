// app/api/decks/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from '@/auth';
import { deckService } from '@/lib/services';

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

    return NextResponse.json(
      {
        success: true,
        decks: result.data,
        count: result.data.length
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
