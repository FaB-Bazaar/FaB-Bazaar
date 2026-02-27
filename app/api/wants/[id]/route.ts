/**
 * Wants Item API Route - PATCH and DELETE
 *
 * Update or remove a specific wants item by printing ID.
 * Uses wantsService for database operations.
 */
import { NextResponse } from "next/server";
import { wantsService } from "@/lib/services";
import { authenticateSession } from "@/lib/auth/multi-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Not authenticated" },
        { status: 401 }
      );
    }

    // Await params before accessing properties (Next.js 15+)
    const { id: printingId } = await params;

    if (!printingId) {
      return NextResponse.json(
        { success: false, error: "Printing ID is required" },
        { status: 400 }
      );
    }

    // Parse request body
    const data = await request.json();

    // Update via service
    const result = await wantsService.updateWantsItem(
      authResult.userId,
      printingId,
      {
        quantity: data.quantity,
        priority: data.priority,
        notes: data.notes,
        value: data.value,
        set: data.set,
        rarity: data.rarity,
        foiling: data.foiling,
        edition: data.edition,
        artVariation: data.artVariation,
        image_url: data.image_url,
      }
    );

    if (!result.success) {
      const status = result.error === "Wants item not found" ? 404 : 500;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    // Return in backward-compatible format
    const item = result.data;
    return NextResponse.json({
      success: true,
      card: {
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
      },
    });
  } catch (error) {
    console.error("[API] Error updating wants list card:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update wants list card" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Not authenticated" },
        { status: 401 }
      );
    }

    // Await params before accessing properties (Next.js 15+)
    const { id: printingId } = await params;

    if (!printingId) {
      return NextResponse.json(
        { success: false, error: "Printing ID is required" },
        { status: 400 }
      );
    }

    // Remove via service (no quantity = remove completely)
    const result = await wantsService.removeWantsItem(
      authResult.userId,
      printingId
    );

    if (!result.success) {
      const status = result.error === "Wants item not found" ? 404 : 500;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Card removed from wants list",
    });
  } catch (error) {
    console.error("[API] Error removing card from wants list:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove card from wants list" },
      { status: 500 }
    );
  }
}
