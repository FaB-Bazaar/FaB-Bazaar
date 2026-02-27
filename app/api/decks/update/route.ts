// app/api/decks/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Hybrid authentication
    const authResult = await authenticateRequest(request, body);

    if (!authResult.success) {
      console.log(`[DeckUpdate] Authentication failed: ${authResult.error}`);
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
        hint: 'Provide either a valid session (web), discordId, or mcp_token parameter'
      }, { status: 401 });
    }

    console.log(`[DeckUpdate] Authenticated user: ${authResult.username} via ${authResult.authMethod}`);

    const {
      deckId,      // publicId - the primary identifier
      publicId,    // also accept as publicId directly
      // Updatable fields
      name,
      description,
      format,
      hero,
      isPublic,
      fabraryUrl,
      newSlug
    } = body;

    // Require deck identifier (publicId)
    const deckPublicId = publicId || deckId;
    if (!deckPublicId) {
      return NextResponse.json(
        { success: false, error: 'Deck publicId required' },
        { status: 400 }
      );
    }

    // Use service layer to update deck
    const result = await deckService.updateDeck(deckPublicId, authResult.userId!, {
      name,
      description,
      format,
      heroName: hero,
      isPublic,
      fabraryUrl,
      slug: newSlug,
    });

    if (!result.success) {
      console.log(`[DeckUpdate] Deck '${deckPublicId}' update failed: ${result.error}`);
      const status = result.error === 'Deck not found or access denied' ? 404 : 400;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    console.log(`[DeckUpdate] Updated deck '${result.data.name}' for user ${authResult.username}`);

    return NextResponse.json({
      success: true,
      deck: result.data,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      message: `Deck '${result.data.name}' updated successfully via ${authResult.authMethod} authentication`,
    });

  } catch (error) {
    console.error('[DeckUpdate] Error updating deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}