// app/api/decks/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Try to get deck publicId from query params first
    let deckPublicId = url.searchParams.get('publicId') || url.searchParams.get('deckId');
    let body: any = {};

    // If not in query params, try to get from body
    if (!deckPublicId) {
      try {
        body = await request.json();
        deckPublicId = body.publicId || body.deckId;
      } catch {
        // Body might be empty, that's ok
      }
    }

    // Hybrid authentication
    const authResult = await authenticateRequest(request, body);

    if (!authResult.success) {
      console.log(`[DeckDelete] Authentication failed: ${authResult.error}`);
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
        hint: 'Provide either a valid session (web), discordId, or Authorization: Bearer <mcp_token> header'
      }, { status: 401 });
    }

    console.log(`[DeckDelete] Authenticated user: ${authResult.username} via ${authResult.authMethod}`);

    // Require deck publicId
    if (!deckPublicId) {
      return NextResponse.json(
        { success: false, error: 'Deck publicId required (in query params or body)' },
        { status: 400 }
      );
    }

    // Use service layer to delete deck
    const result = await deckService.deleteDeck(deckPublicId, authResult.userId!);

    if (!result.success) {
      console.log(`[DeckDelete] Deck not found for user ${authResult.userId} (${authResult.username})`);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 404 });
    }

    console.log(`[DeckDelete] Deleted deck for user ${authResult.username}`);

    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      message: `Deck deleted successfully via ${authResult.authMethod} authentication`,
    });

  } catch (error) {
    console.error('[DeckDelete] Error deleting deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET method removed for security - destructive actions via GET enable CSRF attacks
// Discord bots should use POST or DELETE methods with proper authentication headers