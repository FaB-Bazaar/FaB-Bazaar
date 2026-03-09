// app/api/collection/all-cards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { binderService } from "@/lib/services";
import type { UserCollectionFilters, UserCollectionOptions } from "@/lib/services/contracts/IBinderService";
import { authenticateRequest } from '@/lib/auth/multi-auth';

/**
 * GET /api/collection/all-cards
 *
 * Returns ALL inventory items across all user's non-archived binders (no pagination)
 *
 * Authentication methods supported:
 * - Session auth (web interface)
 * - MCP token (Authorization: Bearer <mcp_token> header)
 * - Discord bot token (X-Discord-Bot-Token header + discordId param)
 *
 * Query parameters:
 * - search: Search by card name or type
 * - sortBy: Sort option (default, name, quantity-desc/asc, tcg-market-desc/asc, tcg-low-desc/asc)
 * - rarity: Filter by rarity
 * - foiling: Filter by foiling
 * - set: Filter by set
 * - condition: Filter by condition
 * - forTrade: Filter by trade status (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Unified authentication (session, Discord bot, MCP token)
    // This properly validates Discord bot tokens via Discord API
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    const currentUserId = authResult.userId!;

    // Parse query parameters
    const search = searchParams.get("search") || "";
    const sortBy = (searchParams.get("sortBy") || "tcg-low-desc") as UserCollectionOptions['sortBy'];

    // Filter parameters
    const rarity = searchParams.get("rarity");
    const foiling = searchParams.get("foiling");
    const set = searchParams.get("set");
    const condition = searchParams.get("condition");
    const forTrade = searchParams.get("forTrade");

    const userIdString = currentUserId;

    // Build filters for service
    const filters: UserCollectionFilters = {};
    if (search) filters.search = search;
    if (rarity) filters.rarity = rarity;
    if (foiling) filters.foiling = foiling;
    if (set) filters.set = set;
    if (condition) filters.condition = condition;
    if (forTrade === "true") filters.forTrade = true;
    else if (forTrade === "false") filters.forTrade = false;

    // Build options for service
    const options: UserCollectionOptions = { sortBy };

    // Use service layer to get all cards
    const result = await binderService.getAllCardsForUser(userIdString, filters, options);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch cards'
      }, { status: 500 });
    }

    // Format cards for response
    const formattedCards = result.data.cards.map(card => ({
      ...card,
      id: card._id,
    }));

    return NextResponse.json({
      success: true,
      cards: formattedCards,
      totalCards: formattedCards.length,
      metadata: result.data.metadata,
      binders: {
        total: result.data.binders.length,
        names: result.data.binders.map(b => ({
          id: b._id,
          name: b.name
        }))
      }
    });

  } catch (error: any) {
    console.error("[Collection All Cards API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
