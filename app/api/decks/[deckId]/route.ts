// app/api/decks/[deckId]/route.ts - Updated for service layer
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, articleService } from '@/lib/services';
import { getValidMetafyAccessToken } from '@/lib/metafy/tokens';

/**
 * Validates that a deck is actually embedded in the specified article/hero
 * Returns true if the deck ID is found in the article's sections
 */
async function isDeckEmbeddedInContent(
  deckId: string,
  articleSlug?: string | null,
  heroSlug?: string | null
): Promise<boolean> {
  if (!articleSlug && !heroSlug) {
    return false;
  }

  try {
    // Fetch the article/hero
    const result = articleSlug
      ? await articleService.getArticleBySlug(articleSlug)
      : await articleService.listArticles(
          { slug: heroSlug, status: 'published', contentType: 'hero' },
          { limit: 1 }
        );

    if (!result.success) {
      return false;
    }

    const article = articleSlug
      ? result.data
      : result.data.articles[0];

    if (!article || article.status !== 'published') {
      return false;
    }

    // Check if any section references this deck
    const isEmbedded = (article.sections || []).some(
      (section: any) =>
        section.type === 'decklist-block' &&
        section.deckId === deckId
    );

    return isEmbedded;
  } catch (error) {
    return false;
  }
}

// GET /api/decks/[deckId]
export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const resolvedParams = await params;
    const url = new URL(request.url);

    // Extract article/hero context from query parameters
    const articleSlug = url.searchParams.get('articleSlug');
    const heroSlug = url.searchParams.get('heroSlug');

    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });

    // Use service layer to fetch deck
    const result = await deckService.findByPublicId(
      resolvedParams.deckId,
      authResult.success ? authResult.userId : undefined
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 404 });
    }

    const deck = result.data;

    // Check if deck exists (should not happen if result.success is true, but defensive check)
    if (!deck) {
      return NextResponse.json({
        success: false,
        error: 'Deck not found'
      }, { status: 404 });
    }

    // Check if deck is embedded in the provided article/hero context
    let isEmbedded = false;
    if ((articleSlug || heroSlug) && !deck.isPublic) {
      isEmbedded = await isDeckEmbeddedInContent(
        resolvedParams.deckId,
        articleSlug,
        heroSlug
      );
    }

    // Check access for private decks (allow if embedded in article/hero)
    if (!deck.isPublic && !isEmbedded && (!authResult.success || deck.userId?.toString() !== authResult.userId)) {
      return NextResponse.json({
        success: false,
        error: 'Deck not found or access denied'
      }, { status: 404 });
    }

    // Determine if user can edit
    const canEdit = authResult.success && deck.userId?.toString() === authResult.userId;

    // Check Metafy guide access (if deck is gated to guide purchasers)
    if (deck.metafyGuideId && !canEdit) {
      let hasAccess = false;
      if (authResult.success) {
        const token = await getValidMetafyAccessToken(authResult.userId);
        if (token) {
          try {
            const purchaseRes = await fetch(
              `https://metafy.gg/irk/api/v1/me/purchases/guides/${deck.metafyGuideId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (purchaseRes.ok) {
              const purchaseData = await purchaseRes.json();
              hasAccess = purchaseData.has_access === true;
            }
          } catch {
            // Network error — deny access
          }
        }
      }
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: `metafy_access_required:${deck.metafyGuideId}` },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...deck, canEdit },
    });

  } catch (error) {
    console.error('[SingleDeck] Error fetching deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/decks/[deckId] - Update deck settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    // Authentication required for updates
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Use service layer to update deck
    const result = await deckService.updateDeck(
      resolvedParams.deckId,
      authResult.userId!,
      {
        name: body.name,
        description: body.description,
        format: body.format,
        heroName: body.hero,
        isPublic: body.isPublic,
        fabraryUrl: body.fabraryUrl,
        metafyGuideId: body.metafyGuideId,
        availableOnTalishar: body.availableOnTalishar,
      }
    );

    if (!result.success) {
      const status = result.error === 'Deck not found or access denied' ? 404 : 400;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    return NextResponse.json({
      success: true,
      deck: result.data,
      message: 'Deck updated successfully'
    });

  } catch (error) {
    console.error('[SingleDeck] Error updating deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/decks/[deckId] - Delete deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const resolvedParams = await params;
    const url = new URL(request.url);

    // Authentication required for deletion
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Use service layer to delete deck
    const result = await deckService.deleteDeck(resolvedParams.deckId, authResult.userId!);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Deck deleted successfully'
    });

  } catch (error) {
    console.error('[SingleDeck] Error deleting deck:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}