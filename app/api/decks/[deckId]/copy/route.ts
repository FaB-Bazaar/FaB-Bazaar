// app/api/decks/[deckId]/copy/route.ts - Copy a public deck to user's collection
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json().catch(() => ({}));

    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch the source deck
    const sourceResult = await deckService.findByPublicId(resolvedParams.deckId);
    if (!sourceResult.success || !sourceResult.data) {
      return NextResponse.json(
        { success: false, error: 'Source deck not found' },
        { status: 404 }
      );
    }

    const sourceDeck = sourceResult.data;

    // Source must be accessible (not private) or owned by the user
    if (sourceDeck.visibility === 'private' && sourceDeck.userId !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Source deck not found or access denied' },
        { status: 404 }
      );
    }

    const newName = body.name?.trim() || `Copy of ${sourceDeck.name}`;

    const result = await deckService.createDeck(authResult.userId!, {
      name: newName,
      description: sourceDeck.description,
      format: sourceDeck.format as any,
      heroName: sourceDeck.heroName,
      visibility: 'unlisted',
      copyFromDeckId: resolvedParams.deckId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[CopyDeck] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
