import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { binderService } from "@/lib/services"

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    // Get binderId from query parameters
    const { searchParams } = new URL(request.url);
    const binderId = searchParams.get('binderId');

    let binderResult;

    if (binderId) {
      // Get specific binder by ID
      binderResult = await binderService.getBinder(binderId, session.user.id);
    } else {
      // Fall back to primary binder if no binderId specified
      binderResult = await binderService.getUserPrimaryBinder(session.user.id);
    }

    if (!binderResult.success) {
      return NextResponse.json({ success: false, error: binderResult.error || "Failed to get binder" }, { status: 500 })
    }

    if (!binderResult.data) {
      return NextResponse.json({ success: false, error: "Binder not found" }, { status: 404 })
    }

    const binder = binderResult.data;

    // Verify the binder belongs to the requesting user
    if (binder.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized access to binder" }, { status: 403 })
    }

    // Get all cards for export using service layer (uses InventoryItem model)
    const exportResult = await binderService.getAllCardsForExport(binder._id);

    if (!exportResult.success) {
      return NextResponse.json({ success: false, error: exportResult.error || "Failed to get cards" }, { status: 500 })
    }

    // Format the data for export
    const exportData = {
      name: binder.name,
      description: binder.description,
      cards: exportResult.data.cards.map((card) => ({
        id: card._id,
        printingId: card.printingId,
        name: card.name,
        displayName: card.display_name,
        set: card.set,
        rarity: card.rarity,
        foiling: card.foiling,
        edition: card.edition,
        quantity: card.quantity,
        condition: card.condition,
        notes: card.notes,
        forTrade: card.forTrade,
        forSale: card.forSale,
        tcgLow: card.tcg_low,
        tcgMarket: card.tcg_market,
      })),
    }

    // Set headers for file download
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="binder-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Export binder error:", error)
    return NextResponse.json({ success: false, error: "Failed to export binder" }, { status: 500 })
  }
}
