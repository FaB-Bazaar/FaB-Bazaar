// app/api/binders/[binderId]/cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthResult } from '@/lib/auth/multi-auth';
import { Types } from 'mongoose';
import { DiscordWebhooks } from '@/lib/discord/discord-webhooks';
import { binderService, printingsService } from '@/lib/services';
import type { BinderCardFilters, BinderCardSearchOptions, AddCardDTO, BinderDTO } from '@/lib/services/contracts/IBinderService';

/**
 * GET /api/binders/[binderId]/cards
 *
 * List cards in a binder with filtering and pagination
 * Uses binderService for all data access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;
    const url = new URL(request.url);

    // Parse query parameters into service layer types
    const filters: BinderCardFilters = {
      search: url.searchParams.get('search') || undefined,
      rarity: url.searchParams.get('rarity') || undefined,
      foiling: url.searchParams.get('foiling') || undefined,
      set: url.searchParams.get('set') || undefined,
      condition: url.searchParams.get('condition') || undefined,
      forTrade: url.searchParams.get('forTrade')
        ? url.searchParams.get('forTrade') === 'true'
        : undefined,
    };

    const options: BinderCardSearchOptions = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '48'),
      sortBy: (url.searchParams.get('sortBy') || 'default') as any,
    };

    // Check access permissions using multi-auth
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    const requestingUserId = authResult.success ? authResult.userId : undefined;

    // Get binder info using service layer
    const binderResult = await binderService.findBinderByIdOrSlug(binderId);
    if (!binderResult.success) {
      return NextResponse.json({
        success: false,
        error: binderResult.error || 'Failed to find binder'
      }, { status: 500 });
    }

    if (!binderResult.data) {
      return NextResponse.json({
        success: false,
        error: 'Binder not found'
      }, { status: 404 });
    }

    const binder = binderResult.data;

    // Check visibility access
    const isOwner = requestingUserId && requestingUserId === binder.userId;
    const level = binder.visibility?.level;
    const isViewable =
      level === 'public' ||
      level === 'unlisted' ||
      (level === undefined && binder.isPublic);

    if (!isOwner && !isViewable) {
      return NextResponse.json({
        success: false,
        error: 'Access denied: This binder is private'
      }, { status: 403 });
    }

    // Use service layer to get cards
    const result = await binderService.getBinderCards(binder._id, filters, options);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    const { cards, pagination, metadata } = result.data;

    // Add id field for backwards compatibility
    const cardsWithId = cards.map(card => ({
      ...card,
      id: card._id
    }));

    // Calculate total cards (sum of quantities)
    const totalCards = cards.reduce((sum, card) => sum + (card.quantity || 1), 0);

    return NextResponse.json({
      success: true,
      cards: cardsWithId,
      pagination: {
        ...pagination,
        totalCards
      },
      metadata,
      binder: {
        _id: binder._id,
        name: binder.name || 'Unknown',
        isOwner: !!isOwner
      }
    });

  } catch (error) {
    console.error('Error fetching binder cards:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch cards'
    }, { status: 500 });
  }
}

/**
 * POST /api/binders/[binderId]/cards
 *
 * Add cards to a binder
 * Uses binderService for all data access
 * Supports: session auth, Discord bot auth, MCP auth
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;
    const body = await request.json();

    // Authenticate request
    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Authentication failed'
      }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Find or create binder if needed (for slug-based access)
    // A binder ID can be a MongoDB ObjectId OR a PostgreSQL UUID — both are treated as IDs.
    // Only non-ID strings (slugs) use getOrCreateBinderBySlug.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isId = Types.ObjectId.isValid(binderId) || UUID_REGEX.test(binderId);

    let binderToUse: BinderDTO;
    if (!isId) {
      // It's a slug — get or create
      const binderResult = await binderService.getOrCreateBinderBySlug(userId, binderId);
      if (!binderResult.success) {
        return NextResponse.json({
          success: false,
          error: binderResult.error || 'Failed to get or create binder'
        }, { status: 500 });
      }
      binderToUse = binderResult.data;
    } else {
      // It's an ID (MongoDB ObjectId or PostgreSQL UUID)
      const binderResult = await binderService.findBinderByIdOrSlug(binderId, userId);
      if (!binderResult.success || !binderResult.data) {
        return NextResponse.json({
          success: false,
          error: 'Binder not found'
        }, { status: 404 });
      }
      binderToUse = binderResult.data;
    }

    // Handle both single card and multiple cards
    const itemsToAdd = body.printings || [body];
    if (!Array.isArray(itemsToAdd) || itemsToAdd.length === 0 || !itemsToAdd[0].printingId) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid "printings" array or printing data.'
      }, { status: 400 });
    }

    // Convert to AddCardDTO format
    const cards: AddCardDTO[] = itemsToAdd.map(item => ({
      printingId: item.printingId,
      quantity: item.quantity || 1,
      condition: item.condition || 'NM',
      language: item.language || 'EN',
      notes: item.notes || '',
      forTrade: item.forTrade !== undefined ? item.forTrade : true,
      forSale: item.forSale !== undefined ? item.forSale : false,
      acquisitionPrice: item.acquisitionPrice,
      acquisitionDate: item.acquisitionDate
    }));

    // Use service layer to add cards
    const result = await binderService.addCardsToBinder(binderToUse._id, userId, cards);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Handle Discord webhook if configured
    if ((result.data.summary.added > 0 || result.data.summary.updated > 0) && binderToUse.visibility?.allowWebhooks) {
      try {
        const successfulResults = result.data.results.filter(r => r.success);
        if (successfulResults.length > 0) {
          // Fetch printing details via service layer for webhook notification
          const printingIds = successfulResults.map(r => r.printingId);
          const printingsResult = await printingsService.getPrintingsByIds(printingIds);

          if (printingsResult.success && printingsResult.data.printings) {
            const printingMap = new Map(printingsResult.data.printings.map(p => [p.printing_id, p]));

            // Enrich results with printing data for Discord notification
            const enrichedResults = successfulResults.map(r => ({
              ...r,
              printingDoc: printingMap.get(r.printingId)
            }));

            const discordData = calculateDiscordNotificationData(authResult, enrichedResults, binderToUse);
            if (discordData) {
              DiscordWebhooks.sendBinderUpdate(discordData).catch(error => {
                console.error('[Discord] Failed to send webhook notification:', error);
              });
            }
          }
        }
      } catch (error) {
        console.error('[Discord] Error calculating notification data:', error);
      }
    }

    return NextResponse.json({
      success: true,
      ...result.data
    });

  } catch (error) {
    console.error('[DEBUG] Caught error in main try-catch:', error);
    console.error('Error adding cards to binder:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to add cards to binder'
    }, { status: 500 });
  }
}

// --- DISCORD NOTIFICATION HELPER ---
function calculateDiscordNotificationData(auth: AuthResult, results: any[], binder: BinderDTO) {
  let totalValueAdded = 0;
  const addedCards: any[] = [];
  const updatedCards: any[] = [];

  for (const result of results) {
    if (!result.success || !result.printingDoc) continue;
    const printing = result.printingDoc;
    const price = printing.tcg_low || 0;
    const quantityChange = result.quantityAdded || 0;
    const cardValueChange = price * quantityChange;
    totalValueAdded += cardValueChange;

    const cardInfo = {
      name: printing.name,
      printingId: printing.printing_id,
      quantity: quantityChange,
      value: cardValueChange,
      foiling: printing.foiling,
      rarity: printing.rarity,
    };

    if (result.action === 'added') {
      addedCards.push(cardInfo);
    } else if (result.action === 'updated') {
      updatedCards.push(cardInfo);
    }
  }

  const notableCards = [...addedCards, ...updatedCards].filter(c =>
    c.value > 10 ||
    ['r', 'c', 'g'].includes(c.foiling?.toLowerCase()) ||
    c.rarity?.toUpperCase() === 'V'
  );

  const baseUrl = process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                'https://fabbazaar.app';

  return {
    username: auth.username,
    binderName: binder.name,
    binderUrl: `${baseUrl}/binder/${binder._id}`,
    addedCount: addedCards.length,
    updatedCount: updatedCards.length,
    valueAdded: totalValueAdded,
    notableCards,
  };
}
