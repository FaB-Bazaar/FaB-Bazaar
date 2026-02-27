/**
 * Wants Get API Route - GET
 *
 * Fetch wants list contents with hybrid authentication (session, Discord ID, OAuth, MCP token).
 * Supports pagination, search, and priority filtering.
 * Uses wantsService for database operations.
 */
import { NextRequest, NextResponse } from "next/server";
import { wantsService } from "@/lib/services";
import { authenticateRequest } from "@/lib/auth/multi-auth";
import {
  getEditionInfo,
  getFoilingInfo,
  getRarityInfo,
} from "@/lib/metadata-service";

// Helper functions to convert codes to readable names (using metadata-service)
async function getEditionName(edition: string): Promise<string> {
  const info = await getEditionInfo(edition);
  return info?.name || edition || "Unknown";
}

async function getFoilingName(foiling: string): Promise<string> {
  const info = await getFoilingInfo(foiling);
  return info?.name || foiling || "Unknown";
}

async function getRarityName(rarity: string): Promise<string> {
  const info = await getRarityInfo(rarity);
  return info?.name || rarity || "Unknown";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Extract query parameters
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "100"),
      100
    ); // Max 100 per page
    const search = url.searchParams.get("search"); // Optional search filter
    const priority = url.searchParams.get("priority"); // Optional priority filter (high, medium, low)

    if (page < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid page number. Must be 1 or greater.",
        },
        { status: 400 }
      );
    }

    // Hybrid authentication (session, Discord ID, MCP token, or OAuth)
    const authResult = await authenticateRequest(req, {}, { allowOAuth: true });

    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || "Authentication required",
          hint: "Provide either a valid session (web), discordId query parameter, mcp_token query parameter, or OAuth Bearer token (Authorization: Bearer <token>)",
        },
        { status: 401 }
      );
    }

    // OAuth client credentials without specific user
    if (!authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User-specific wants list access requires user token, not client credentials",
          hint: "Use a user-specific OAuth token, MCP token, or Discord ID to access wants lists",
        },
        { status: 403 }
      );
    }

    // Build filters
    const filters: {
      search?: string;
      priority?: "high" | "medium" | "low";
    } = {};

    if (search) {
      filters.search = search;
    }

    if (priority && ["high", "medium", "low"].includes(priority.toLowerCase())) {
      filters.priority = priority.toLowerCase() as "high" | "medium" | "low";
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get wants list via service
    const result = await wantsService.getUserWants(authResult.userId, filters, {
      skip,
      limit,
      sort: { addedAt: -1 },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const { items, total: totalCards } = result.data;
    const totalPages = Math.ceil(totalCards / limit);

    // If no items, return empty response
    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        authMethod: authResult.authMethod,
        authenticatedUser: authResult.username,
        metadata: {
          wants_list_name: "My Wants List",
          total_cards: 0,
          total_unique_printings: 0,
          current_page: page,
          total_pages: 0,
          cards_per_page: limit,
          cards_in_page: 0,
          has_next_page: false,
          has_previous_page: false,
          search_query: search || null,
          priority_filter: priority || null,
        },
        cards: [],
      });
    }

    // Format the response with detailed printing information from denormalized data
    const formattedCards = await Promise.all(
      items.map(async (item) => {
        return {
          printing_id: item.printingId,
          card_id: item.card_unique_id || "",
          display_name: item.display_name || item.name,
          quantity: item.quantity,
          priority: item.priority,

          // Detailed printing information from denormalized data
          set: item.set || "",
          edition: item.edition || "",
          foiling: item.foiling || "",
          rarity: item.rarity || "",

          // Expanded edition/foiling/rarity names for clarity
          edition_name: await getEditionName(item.edition || ""),
          foiling_name: await getFoilingName(item.foiling || ""),
          rarity_name: await getRarityName(item.rarity || ""),

          // Price information from denormalized data
          tcg_market: item.tcg_market || null,
          tcg_low: item.tcg_low || null,
          tcg_mid: item.tcg_mid || null,
          tcg_high: item.tcg_high || null,

          // Purchase link and image from denormalized data
          tcgplayer_url: item.tcgplayer_url || null,
          image_url: item.image_url || null,
        };
      })
    );

    // Prepare metadata
    const metadata = {
      wants_list_name: "My Wants List",
      total_cards: totalCards,
      total_unique_printings: totalCards,
      current_page: page,
      total_pages: totalPages,
      cards_per_page: limit,
      cards_in_page: formattedCards.length,
      has_next_page: page < totalPages,
      has_previous_page: page > 1,
      search_query: search || null,
      priority_filter: priority || null,
    };

    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      metadata,
      cards: formattedCards,
    });
  } catch (err: any) {
    console.error("[API] Error fetching wants list:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch wants list",
      },
      { status: 500 }
    );
  }
}
