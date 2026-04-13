/**
 * Public Wants List API Route - GET
 *
 * Fetch another user's wants list (respects privacy settings).
 * Uses wantsService and userService for database operations.
 */
import { NextResponse } from "next/server";
import { wantsService, userService } from "@/lib/services";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await the params promise before destructuring (Next.js 15+)
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user's wants list via service
    const result = await wantsService.getUserWants(userId, undefined, {
      limit: 1000,
      sort: { addedAt: -1 },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const items = result.data.items;

    // Check user exists and get user info via service
    const userResult = await userService.getBasicInfo(userId);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.data;

    // NOTE: Wants lists are always public, so no privacy check is needed
    const isPublic = true;

    // Handle empty wants list - return empty array instead of 404
    if (items.length === 0) {
      const wantsListResponse = {
        _id: user._id,
        userId: user._id,
        name: `${user.username || user.discordUsername}'s Wants List`,
        isPublic: isPublic,
        cards: [],
        discordUsername: user.discordUsername,
        discordId: user.discordId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return NextResponse.json({
        success: true,
        wantsList: wantsListResponse,
      });
    }

    // Transform to backward-compatible format using denormalized data
    const cards = items.map((item) => {
      return {
        id: item.printingId,
        _id: item._id,
        name: item.name,
        quantity: item.quantity || 1,
        priority: item.priority || "medium",
        notes: item.notes || "",
        printingId: item.printingId,
        color: item.color,
        // Use denormalized data for printing details
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
      createdAt: items.length > 0 ? items[items.length - 1].addedAt : new Date(),
      updatedAt: items.length > 0 ? items[0].addedAt : new Date(),
    };

    return NextResponse.json({
      success: true,
      wantsList: wantsListResponse,
    });
  } catch (error) {
    console.error("[API] Error fetching wants list:", error);
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? (error as Error).message
        : "Failed to fetch wants list";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
