/**
 * Wants Add API Route - POST
 *
 * Add cards to wants list with hybrid authentication (session, Discord bot, MCP token).
 * Supports single and batch operations.
 * Uses wantsService for database operations.
 */
import { NextRequest, NextResponse } from "next/server";
import { wantsService } from "@/lib/services";
import { authenticateRequest } from "@/lib/auth/multi-auth";
import { DiscordWebhooks } from "@/lib/discord/discord-webhooks";

/**
 * Calculate Discord notification data from wants update results
 */
async function calculateWantsNotificationData(
  auth: { userId: string; username?: string },
  results: Array<{
    printingId: string;
    success: boolean;
    action?: string;
    cardName?: string;
    quantity?: number;
    priority?: string;
    foiling?: string;
    value?: number;
  }>,
  userId: string
) {
  try {
    const successfulResults = results.filter((r) => r.success);
    if (successfulResults.length === 0) return null;

    // Calculate cards added with their details from the results (denormalized data)
    const cardsAdded = successfulResults.map((result) => ({
      name: result.cardName || "Unknown Card",
      printingId: result.printingId,
      foiling: result.foiling,
      value: result.value || 0,
      quantity: result.quantity || 1,
      priority: result.priority || "medium",
    }));

    // Get stats via service instead of direct aggregation
    const statsResult = await wantsService.getWantsStats(userId);
    const stats = statsResult.success
      ? statsResult.data
      : {
          totalUniqueCards: 0,
          totalCardQuantity: 0,
          highPriorityUniqueCount: 0,
          highPriorityQuantity: 0,
          totalEstimatedValue: 0,
        };

    const baseUrl = process.env.AUTH_URL ||
                    process.env.NEXTAUTH_URL ||
                    'https://fabbazaar.app';

    return {
      username: auth.username || "Unknown User",
      cardsAdded,
      // Provide both unique and quantity counts for Discord notifications
      totalWantsCount: stats.totalCardQuantity,       // Total cards (with quantity)
      totalUniqueCards: stats.totalUniqueCards,       // Unique printings
      highPriorityCount: stats.highPriorityQuantity,  // High priority total quantity
      highPriorityUniqueCount: stats.highPriorityUniqueCount,
      totalEstimatedValue: stats.totalEstimatedValue,
      userId,
      wantsUrl: `${baseUrl}/wants/${userId}`,
    };
  } catch (error) {
    console.error("[Discord] Error calculating wants notification data:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Hybrid authentication - tries session first, then discordId, then mcpToken
    const authResult = await authenticateRequest(req, body);

    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed",
        },
        { status: 401 }
      );
    }

    // Extract parameters - support both single and batch operations
    const {
      printingId, // Single printing (backwards compatibility)
      quantity = 1,
      priority = "medium",
      notes = "",
      printings, // Array of { printingId, quantity, priority?, notes? }
    } = body;

    // Validate input - must have either single printingId or printings array
    if (
      !printingId &&
      (!printings || !Array.isArray(printings) || printings.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: printingId or printings array",
        },
        { status: 400 }
      );
    }

    const results: Array<{
      printingId: string;
      success: boolean;
      action?: string;
      cardName?: string;
      quantity?: number;
      priority?: string;
      foiling?: string;
      value?: number;
      error?: string;
    }> = [];

    // Handle single printing (backwards compatibility)
    if (printingId) {
      const result = await wantsService.addWantsItem(authResult.userId, {
        printingId,
        quantity,
        priority,
        notes,
      });

      results.push({
        printingId,
        success: result.success,
        action: result.success ? result.data.action : undefined,
        cardName: result.success ? result.data.item.display_name : undefined,
        quantity,
        priority,
        foiling: result.success ? result.data.item.foiling : undefined,
        value: result.success ? result.data.item.tcg_market : undefined,
        error: result.success ? undefined : result.error,
      });
    }

    // Handle batch printings
    if (printings && Array.isArray(printings)) {
      for (const item of printings) {
        if (!item.printingId) {
          results.push({
            printingId: item.printingId,
            success: false,
            error: "Missing printingId in batch item",
          });
          continue;
        }

        const result = await wantsService.addWantsItem(authResult.userId, {
          printingId: item.printingId,
          quantity: item.quantity || 1,
          priority: item.priority || "medium",
          notes: item.notes,
        });

        results.push({
          printingId: item.printingId,
          success: result.success,
          action: result.success ? result.data.action : undefined,
          cardName: result.success ? result.data.item.display_name : undefined,
          quantity: item.quantity || 1,
          priority: item.priority || "medium",
          foiling: result.success ? result.data.item.foiling : undefined,
          value: result.success ? result.data.item.tcg_market : undefined,
          error: result.success ? undefined : result.error,
        });
      }
    }

    const successfulResults = results.filter((r) => r.success);

    // Send Discord notification (fire and forget)
    try {
      if (successfulResults.length > 0) {
        const discordData = await calculateWantsNotificationData(
          { userId: authResult.userId, username: authResult.username },
          successfulResults,
          authResult.userId
        );

        if (discordData) {
          // Don't await - fire and forget so it doesn't slow down the response
          DiscordWebhooks.sendWantsUpdate(discordData).catch((error) => {
            console.error("[Discord] Wants webhook notification failed:", error);
          });
        }
      }
    } catch (error) {
      console.error("[Discord] Failed to send wants update notification:", error);
      // Don't fail the main request if Discord notification fails
    }

    // Prepare response summary
    const summary = {
      total: results.length,
      added: results.filter((r) => r.success && r.action === "created").length,
      updated: results.filter((r) => r.success && r.action === "updated").length,
      failed: results.filter((r) => !r.success).length,
    };

    // Return appropriate response based on operation type
    if (printingId && !printings) {
      // Single operation response (backwards compatible)
      const result = results[0];
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Operation failed",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Operation completed successfully",
      });
    } else {
      // Batch operation response
      return NextResponse.json({
        success: summary.failed === 0,
        message:
          summary.failed === 0
            ? "Operation completed successfully"
            : "Operation completed with some failures",
      });
    }
  } catch (err: any) {
    console.error("[API] Error adding to wants list:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Operation failed",
      },
      { status: 500 }
    );
  }
}
