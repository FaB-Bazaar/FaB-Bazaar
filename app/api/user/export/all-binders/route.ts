import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { binderService } from "@/lib/services"

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    // Get all user's binders
    const bindersResult = await binderService.getUserBindersWithStats(session.user.id);

    if (!bindersResult.success) {
      return NextResponse.json({ success: false, error: bindersResult.error || "Failed to get binders" }, { status: 500 })
    }

    if (!bindersResult.data || bindersResult.data.length === 0) {
      return NextResponse.json({ success: false, error: "No binders found" }, { status: 404 })
    }

    // Get cards for each binder
    const bindersWithCards = await Promise.all(
      bindersResult.data.map(async (binder) => {
        const cardsResult = await binderService.getAllCardsForExport(binder._id);

        if (!cardsResult.success) {
          console.error(`Failed to get cards for binder ${binder._id}:`, cardsResult.error);
          return {
            id: binder._id,
            name: binder.name,
            description: binder.description || "",
            isPublic: binder.isPublic,
            cards: [],
            error: cardsResult.error
          };
        }

        return {
          id: binder._id,
          name: binder.name,
          description: binder.description || "",
          isPublic: binder.isPublic,
          stats: binder.stats,
          cards: cardsResult.data.cards.map((card) => ({
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
        };
      })
    );

    // Calculate total cards (sum of all quantities, not just unique printings)
    const totalCards = bindersWithCards.reduce((sum, b) => {
      return sum + b.cards.reduce((cardSum: number, card: any) => cardSum + (card.quantity || 1), 0);
    }, 0);

    // Format the data for export
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: session.user.id,
      username: session.user.name || session.user.username,
      totalBinders: bindersWithCards.length,
      totalCards: totalCards,
      totalUniqueCards: bindersWithCards.reduce((sum, b) => sum + b.cards.length, 0),
      binders: bindersWithCards,
    };

    // Set headers for file download
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="all-binders-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Export all binders error:", error)
    return NextResponse.json({ success: false, error: "Failed to export all binders" }, { status: 500 })
  }
}
