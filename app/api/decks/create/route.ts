// app/api/decks/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

/**
 * Validate Fabrary URL and extract deck ID
 */
function validateFabraryUrl(url: string): { isValid: boolean; deckId?: string } {
  if (!url) return { isValid: true }; // Optional field

  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'fabrary.net') {
      return { isValid: false };
    }

    const match = url.match(/\/decks\/([A-Z0-9]+)/i);
    if (match) {
      return { isValid: true, deckId: match[1] };
    }

    return { isValid: false };
  } catch {
    return { isValid: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Hybrid authentication
    const authResult = await authenticateRequest(request, body);

    if (!authResult.success) {
      console.log(`[DeckCreate] Authentication failed: ${authResult.error}`);
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
        hint: 'Provide either a valid session (web), discordId, or Authorization: Bearer <mcp_token> header'
      }, { status: 401 });
    }

    console.log(`[DeckCreate] Authenticated user: ${authResult.username} via ${authResult.authMethod}`);

    const {
      name,
      description,
      format,
      hero,
      isPublic,
      visibility,
      fabraryUrl,
      slug,
      copyFromDeckId,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Deck name is required' },
        { status: 400 }
      );
    }

    if (!format?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Format is required' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats = ['Blitz', 'Classic Constructed', 'Commoner', 'Draft', 'Sealed', 'Living Legend', 'Limited', 'Ultimate Pit Fight', 'Casual'];
    if (!validFormats.includes(format.trim())) {
      return NextResponse.json(
        { success: false, error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate Fabrary URL if provided
    if (fabraryUrl) {
      const fabraryValidation = validateFabraryUrl(fabraryUrl);
      if (!fabraryValidation.isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid Fabrary URL. Must be a valid fabrary.net deck URL.' },
          { status: 400 }
        );
      }
    }

    // Use service layer to create deck
    const result = await deckService.createDeck(authResult.userId!, {
      name: name.trim(),
      description: description?.trim(),
      format: format.trim(),
      heroName: hero?.trim(),
      visibility: visibility || (isPublic ? 'public' : undefined),
      fabraryUrl: fabraryUrl?.trim(),
      slug,
      copyFromDeckId,
    });

    if (!result.success) {
      console.error('[DeckCreate] Error creating deck:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    console.log(`[DeckCreate] Created deck '${name}' with slug '${result.data.slug}' for user ${authResult.username}`);

    return NextResponse.json({
      success: true,
      deck: result.data,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      message: `Deck '${name}' created successfully via ${authResult.authMethod} authentication`,
    });

  } catch (error) {
    console.error('[DeckCreate] Error creating deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
