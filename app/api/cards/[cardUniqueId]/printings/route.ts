import { NextRequest, NextResponse } from "next/server";
import { printingsService } from "@/lib/services";

/**
 * GET /api/cards/[cardUniqueId]/printings
 *
 * Public. Returns all printings for one card — used by the QuickAddCardDialog
 * printing picker when a user clicks a card tile to choose a specific
 * set/foiling/edition. Lazy-loaded so the hero pool fetch (one row per card)
 * stays small.
 *
 * Service layer only — no direct DB access in the route.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardUniqueId: string }> }
) {
  const { cardUniqueId } = await params;

  const result = await printingsService.getPrintingsForCard(cardUniqueId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  if (!result.data || result.data.total === 0) {
    return NextResponse.json(
      { success: false, error: "No printings found for this card" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { printings: result.data.printings },
  });
}
