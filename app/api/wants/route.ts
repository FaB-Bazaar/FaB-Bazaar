/**
 * Wants List API Route - GET and POST
 *
 * GET: Fetch current user's wants list (with optional count mode)
 * POST: Add a card to wants list
 * Uses wantsService and userService for database operations.
 */
import { NextRequest, NextResponse } from "next/server";
import { wantsService, userService } from "@/lib/services";
import { authenticateSession } from "@/lib/auth/multi-auth";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    const countParam = searchParams.get("count");

    // Use target user if specified, otherwise current user
    const userId = targetUserId || authResult.userId;

    // Count mode - just return total quantity
    // NOTE: Count mode is available for any user since wants lists are always public
    if (countParam === "true") {
      const countResult = await wantsService.getTotalWantsQuantity(userId);
      if (!countResult.success) {
        return NextResponse.json(
          { success: false, error: countResult.error },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, totalCards: countResult.data });
    }

    // Get wants list via service
    const wantsResult = await wantsService.getUserWants(userId, undefined, {
      limit: 1000,
      sort: { addedAt: -1 },
    });

    if (!wantsResult.success) {
      return NextResponse.json(
        { success: false, error: wantsResult.error },
        { status: 500 }
      );
    }

    const items = wantsResult.data.items;

    // Get user info for metadata via service
    const userResult = await userService.getBasicInfo(userId);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.data;
    const isPublic = true;

    // NOTE: Wants lists are always public, no privacy check needed

    // Transform to backward-compatible format using denormalized data
    const cards = items.map((item) => {
      return {
        id: item.printingId,
        cardId: item.card_unique_id,
        name: item.name,
        pitch: item.pitch,
        set: item.set,
        rarity: item.rarity,
        foiling: item.foiling,
        is_extended_art: item.is_extended_art,
        color: item.color,
        printingId: item.printingId,
        quantity: item.quantity,
        priority: item.priority,
        notes: item.notes || "",
        value: item.tcg_market || "",
        _id: item._id,
        // Use denormalized data for printing details
        printingDetails: {
          printing_id: item.printingId,
          name: item.name,
          display_name: item.display_name,
          pitch: item.pitch,
          set: item.set,
          edition: item.edition,
          foiling: item.foiling,
          rarity: item.rarity,
          color: item.color,
          image_url: item.image_url,
          type_text: item.type_text,
          type_text_display: item.type_text_display,
          card_text: item.card_text,
          collector_number: item.collector_number,
          tcg_low: item.tcg_low,
          tcg_mid: item.tcg_mid,
          tcg_high: item.tcg_high,
          tcg_market: item.tcg_market,
          tcgplayer_url: item.tcgplayer_url,
        },
        priceInfo: {
          tcgLow: item.tcg_low ?? "N/A",
          tcgMid: item.tcg_mid ?? "N/A",
          tcgHigh: item.tcg_high ?? "N/A",
          tcgMarket: item.tcg_market ?? "N/A",
          tcgplayer_url: item.tcgplayer_url ?? null,
        },
      };
    });

    // Build response in old WantsList format for backward compatibility
    const wantsListResponse = {
      _id: user._id,
      userId: user._id,
      name: `${user.username || user.discordUsername}'s Wants List`,
      isPublic: isPublic,
      cards: cards,
      discordUsername: user.discordUsername,
      discordId: user.discordId,
      createdAt:
        items.length > 0 ? items[items.length - 1].addedAt : new Date(),
      updatedAt: items.length > 0 ? items[0].addedAt : new Date(),
    };

    return NextResponse.json({ success: true, wantsList: wantsListResponse });
  } catch (error) {
    console.error("[API] Get wants list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get wants list" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cardId, printingId, quantity, priority, notes } = body;

    // Require at least printingId or cardId
    if (!printingId && !cardId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: printingId or cardId must be provided",
        },
        { status: 400 }
      );
    }

    // Add via service
    const result = await wantsService.addWantsItem(authResult.userId, {
      printingId: printingId || cardId,
      quantity: quantity || 1,
      priority: priority || "medium",
      notes: notes || "",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const item = result.data.item;

    // Return card in old format for backward compatibility
    // Use denormalized data from the item instead of fetching from printings
    const card = {
      id: item.printingId,
      cardId: item.card_unique_id,
      name: item.name,
      set: item.set,
      rarity: item.rarity,
      foiling: item.foiling,
      printingId: item.printingId,
      quantity: item.quantity,
      priority: item.priority,
      notes: item.notes,
      value: item.tcg_market,
      _id: item._id,
      printingDetails: {
        printing_id: item.printingId,
        name: item.name,
        display_name: item.display_name,
        set: item.set,
        edition: item.edition,
        foiling: item.foiling,
        rarity: item.rarity,
        color: item.color,
        image_url: item.image_url,
        collector_number: item.collector_number,
        tcg_low: item.tcg_low,
        tcg_mid: item.tcg_mid,
        tcg_high: item.tcg_high,
        tcg_market: item.tcg_market,
        tcgplayer_url: item.tcgplayer_url,
      },
    };

    return NextResponse.json({ success: true, card });
  } catch (error) {
    console.error("[API] Add card to wants list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add card to wants list" },
      { status: 500 }
    );
  }
}
