/**
 * Wants Bulk Import API Route - POST
 *
 * Import multiple cards to wants list with name-based lookup.
 * Uses wantsService for database operations.
 */
import { NextResponse } from "next/server";
import { wantsService } from "@/lib/services";
import { authenticateSession } from "@/lib/auth/multi-auth";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Not authenticated" },
        { status: 401 }
      );
    }

    const { cards } = await request.json();

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { success: false, error: "No cards provided" },
        { status: 400 }
      );
    }

    // Use service for bulk import
    const result = await wantsService.bulkImportWants(
      authResult.userId,
      cards.map((card) => ({
        name: card.name,
        printingId: card.printingId,
        quantity: card.quantity || 1,
        priority: card.priority || "medium",
        pitch: card.pitch,
      }))
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const { summary, notFoundCards, results } = result.data;

    // Transform to backward-compatible response format
    const addedCards =
      results
        ?.filter((r) => r.success && r.action === "created")
        .map((r) => ({
          name: r.name,
          quantity: 1,
        })) || [];

    const updatedCards =
      results
        ?.filter((r) => r.success && r.action === "updated")
        .map((r) => ({
          name: r.name,
          quantity: 1,
        })) || [];

    const skippedCards =
      results
        ?.filter((r) => !r.success && r.error !== "Card not found")
        .map((r) => ({
          name: r.name,
          reason: r.error,
        })) || [];

    return NextResponse.json({
      success: true,
      summary: {
        added: summary.added,
        updated: summary.updated,
        skipped: summary.skipped,
        notFound: summary.notFound,
      },
      details: {
        added: addedCards,
        updated: updatedCards,
        skipped: skippedCards,
        notFound: notFoundCards.map((name) => ({ name })),
      },
    });
  } catch (error) {
    console.error("[API] Error handling bulk import:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import cards" },
      { status: 500 }
    );
  }
}
