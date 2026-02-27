// app/api/collection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasAuthParams } from '@/lib/auth/multi-auth';
import { binderService, userService } from '@/lib/services';

/**
 * GET /api/collection
 *
 * Returns collection data based on query parameters and authentication:
 *
 * Authentication methods:
 * - Session auth (web interface): Returns user's own complete collection
 * - MCP token (?mcp_token=xyz): Returns user's own complete collection
 * - Discord bot token + discordId: Returns user's own complete collection
 * - Public access (?userId=xyz): Returns summary stats
 *
 * Query parameters:
 * - userId: View another user's collection (public data only)
 * - view: 'complete' | 'summary' (defaults to 'complete' for own data, 'summary' for others)
 * - mcp_token: MCP token authentication
 * - discordId: For Discord bot authentication
 * - discord_bot_token: Bot token (also accepts X-Discord-Bot-Token header)
 *
 * Response modes:
 * - complete: Full collection stats (private data, only for authenticated owner)
 * - summary: Minimal overview stats
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId');
    const view = searchParams.get('view') as 'complete' | 'summary';

    // Check if auth params were provided (to enforce strict rejection on invalid tokens)
    const authParamsProvided = hasAuthParams(req, {});

    // Unified authentication (session, Discord bot, MCP token)
    // This properly validates Discord bot tokens via Discord API
    const authResult = await authenticateRequest(req, {});

    let currentUserId: string | null = null;
    let isAuthenticated = false;

    if (authResult.success) {
      currentUserId = authResult.userId!;
      isAuthenticated = true;
    } else if (authParamsProvided) {
      // Auth params were provided but validation failed - reject with 401
      // This prevents serving public data when someone provides invalid credentials
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication failed'
      }, { status: 401 });
    }

    let targetUserId: string;
    let isOwnCollection = false;

    if (requestedUserId) {
      targetUserId = requestedUserId;
      isOwnCollection = isAuthenticated && currentUserId === requestedUserId;
    } else if (currentUserId) {
      targetUserId = currentUserId;
      isOwnCollection = true;
    } else {
      return NextResponse.json({
        success: false,
        error: 'Authentication required or userId parameter needed for public access'
      }, { status: 401 });
    }

    // Determine what data to return
    let requestedView = view;
    if (!requestedView) {
      // Default view logic
      requestedView = isOwnCollection ? 'complete' : 'summary';
    }

    // Security check: only owner can see complete collection
    if (requestedView === 'complete' && !isOwnCollection) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied: complete collection view requires authentication as collection owner' 
      }, { status: 403 });
    }

    // Get user info for response
    const userResult = await userService.getBasicInfo(targetUserId);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }
    const user = userResult.data;

    // Get all user's binders with their stats (exclude archived binders)
    const bindersResult = await binderService.getUserBindersWithStats(targetUserId);
    if (!bindersResult.success) {
      return NextResponse.json({
        success: false,
        error: bindersResult.error
      }, { status: 500 });
    }

    if (bindersResult.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No binders found for user'
      }, { status: 404 });
    }

    // Aggregate stats from all binders
    const aggregatedStats = aggregateBinderStats(bindersResult.data);

    // Build response based on requested view
    let responseData: any = {
      userId: targetUserId,
      username: user.username || user.discordUsername || 'Unknown',
      countryCode: undefined, // countryCode not in UserBasicInfoDTO, would need UserProfileDTO
      calculatedAt: new Date().toISOString()
    };

    switch (requestedView) {
      case 'complete':
        // Full collection data (private)
        responseData.collection = aggregatedStats;
        break;

      case 'summary':
        // Minimal overview
        responseData.summary = {
          totalCards: aggregatedStats.totalQuantity,
          totalValue: aggregatedStats.totalValues.tcg_market,
          binderCount: aggregatedStats.binderCount,
          publicBinderCount: aggregatedStats.publicBinderCount
        };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid view parameter. Must be: complete or summary'
        }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      data: responseData,
      meta: {
        view: requestedView,
        isOwnCollection,
        isAuthenticated,
        accessLevel: isOwnCollection ? 'owner' : 'public'
      }
    });

  } catch (error) {
    console.error('Error fetching collection:', error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}

/**
 * Aggregate stats from multiple binders into collection-wide totals
 */
function aggregateBinderStats(binders: any[]) {
  const stats = {
    totalQuantity: 0,
    quantityForTrade: 0,
    quantityNotForTrade: 0,
    totalValues: {
      tcg_market: 0,
      tcg_low: 0,
      tcg_mid: 0,
      tcg_high: 0
    },
    valueForTrade: {
      tcg_market: 0,
      tcg_low: 0,
      tcg_mid: 0,
      tcg_high: 0
    },
    valueNotForTrade: {
      tcg_market: 0,
      tcg_low: 0,
      tcg_mid: 0,
      tcg_high: 0
    },
    rarityCounts: {} as Record<string, number>,
    rarityCountsForTrade: {} as Record<string, number>,
    rarityCountsNotForTrade: {} as Record<string, number>,
    binderCount: binders.length,
    publicBinderCount: binders.filter(b =>
      b.isPublic === true ||
      b.visibility?.level === 'public'
    ).length
  };

  // Aggregate from each binder
  for (const binder of binders) {
    const binderStats = binder.stats;
    if (!binderStats) continue;

    // Aggregate quantities
    stats.totalQuantity += binderStats.totalQuantity || 0;
    stats.quantityForTrade += binderStats.quantityForTrade || 0;
    stats.quantityNotForTrade += binderStats.quantityNotForTrade || 0;

    // Aggregate values
    if (binderStats.totalValue) {
      stats.totalValues.tcg_market += binderStats.totalValue.tcg_market || 0;
      stats.totalValues.tcg_low += binderStats.totalValue.tcg_low || 0;
      stats.totalValues.tcg_mid += binderStats.totalValue.tcg_mid || 0;
      stats.totalValues.tcg_high += binderStats.totalValue.tcg_high || 0;
    }

    if (binderStats.valueForTrade) {
      stats.valueForTrade.tcg_market += binderStats.valueForTrade.tcg_market || 0;
      stats.valueForTrade.tcg_low += binderStats.valueForTrade.tcg_low || 0;
      stats.valueForTrade.tcg_mid += binderStats.valueForTrade.tcg_mid || 0;
      stats.valueForTrade.tcg_high += binderStats.valueForTrade.tcg_high || 0;
    }

    if (binderStats.valueNotForTrade) {
      stats.valueNotForTrade.tcg_market += binderStats.valueNotForTrade.tcg_market || 0;
      stats.valueNotForTrade.tcg_low += binderStats.valueNotForTrade.tcg_low || 0;
      stats.valueNotForTrade.tcg_mid += binderStats.valueNotForTrade.tcg_mid || 0;
      stats.valueNotForTrade.tcg_high += binderStats.valueNotForTrade.tcg_high || 0;
    }

    // Aggregate rarity counts
    if (binderStats.rarityCounts) {
      for (const [rarity, count] of Object.entries(binderStats.rarityCounts)) {
        stats.rarityCounts[rarity] = (stats.rarityCounts[rarity] || 0) + (count as number);
      }
    }

    if (binderStats.rarityCountsForTrade) {
      for (const [rarity, count] of Object.entries(binderStats.rarityCountsForTrade)) {
        stats.rarityCountsForTrade[rarity] = (stats.rarityCountsForTrade[rarity] || 0) + (count as number);
      }
    }

    if (binderStats.rarityCountsNotForTrade) {
      for (const [rarity, count] of Object.entries(binderStats.rarityCountsNotForTrade)) {
        stats.rarityCountsNotForTrade[rarity] = (stats.rarityCountsNotForTrade[rarity] || 0) + (count as number);
      }
    }
  }

  return stats;
}