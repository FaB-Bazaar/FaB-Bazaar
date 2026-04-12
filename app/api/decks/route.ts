
// app/api/decks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // For GET requests, check query params for auth
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });

    if (!authResult.success) {
      console.log(`[DeckAPI] GET Authentication failed: ${authResult.error}`);
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
        hint: 'Provide either a valid session (web), X-Discord-User-Id header, or Authorization: Bearer <mcp_token> header'
      }, { status: 401 });
    }

    console.log(`[DeckAPI] GET Authenticated user: ${authResult.username} via ${authResult.authMethod}`);

    // Check if superadmin to include system decks
    const adminCheck = await userService.hasRole(authResult.userId!, 'isSuperAdmin');
    const includeSystemDecks = adminCheck.success && adminCheck.data;

    // Use service layer to fetch decks
    const result = await deckService.listUserDecks(authResult.userId!, { includeSystemDecks });

    if (!result.success) {
      console.error('[DeckAPI] Error fetching decks:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    console.log(`[DeckAPI] Retrieved ${result.data.decks.length} decks for user ${authResult.username}`);

    return NextResponse.json({
      success: true,
      decks: result.data.decks,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
    });

  } catch (error) {
    console.error('[DeckAPI] Error fetching decks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Hybrid authentication
    const authResult = await authenticateRequest(request, body, { allowOAuth: true });

    if (!authResult.success) {
      console.log(`[DeckAPI] POST Authentication failed: ${authResult.error}`);
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
        hint: 'Provide either a valid session (web), discordId, or Authorization: Bearer <mcp_token> header'
      }, { status: 401 });
    }

    console.log(`[DeckAPI] POST Authenticated user: ${authResult.username} via ${authResult.authMethod}`);

    const { name, description, format, hero, heroPrintingId, isPublic, visibility, fabraryUrl, slug } = body;

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

    // Use service layer to create deck
    const result = await deckService.createDeck(authResult.userId!, {
      name: name.trim(),
      description: description?.trim(),
      format: format.trim(),
      heroName: hero?.trim(),
      heroPrintingId,
      visibility: visibility || (isPublic ? 'public' : undefined),
      fabraryUrl: fabraryUrl?.trim(),
      slug,
    });

    if (!result.success) {
      console.error('[DeckAPI] Error creating deck:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    console.log(`[DeckAPI] Created deck '${name}' with slug '${result.data.slug}' for user ${authResult.username}`);

    return NextResponse.json({
      success: true,
      data: result.data,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      message: `Deck created successfully via ${authResult.authMethod} authentication`,
    });

  } catch (error) {
    console.error('[DeckAPI] Error creating deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}