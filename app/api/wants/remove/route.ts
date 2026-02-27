/**
 * Wants Remove API Route - POST
 *
 * Remove cards from wants list with hybrid authentication (session, Discord bot, MCP token).
 * Supports single and batch operations.
 * Uses wantsService for database operations.
 */
import { NextRequest, NextResponse } from "next/server";
import { wantsService } from "@/lib/services";
import { authenticateRequest } from "@/lib/auth/multi-auth";

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
      printingId,
      quantity = 1,
      removeAll = false, // Flag to remove all copies regardless of quantity
      printings, // Array of { printingId, quantity, removeAll? }
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
      error?: string;
    }> = [];

    // Handle single printing
    if (printingId) {
      // If removeAll, don't pass quantity (service will remove completely)
      const result = await wantsService.removeWantsItem(
        authResult.userId,
        printingId,
        removeAll ? undefined : quantity
      );

      results.push({
        printingId,
        success: result.success,
        action: result.success ? result.data.action : undefined,
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

        const result = await wantsService.removeWantsItem(
          authResult.userId,
          item.printingId,
          item.removeAll ? undefined : item.quantity || 1
        );

        results.push({
          printingId: item.printingId,
          success: result.success,
          action: result.success ? result.data.action : undefined,
          error: result.success ? undefined : result.error,
        });
      }
    }

    const successfulResults = results.filter((r) => r.success);

    // Prepare response summary
    const summary = {
      total: results.length,
      removed_completely: results.filter(
        (r) => r.success && r.action === "removed"
      ).length,
      reduced_quantity: results.filter(
        (r) => r.success && r.action === "reduced"
      ).length,
      failed: results.filter((r) => !r.success).length,
    };

    // Return appropriate response based on operation type
    if (printingId && !printings) {
      // Single operation response
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
    console.error("[API] Error removing cards from wants list:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Operation failed",
      },
      { status: 500 }
    );
  }
}
