import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { binderService } from "@/lib/services"

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user.id) {
    return NextResponse.json({ binders: [] }, { status: 401 })
  }

  const result = await binderService.getUserBindersWithStats(session.user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  // Flatten nested stats to top level for CollectionTile compatibility
  const binders = result.data.map(b => ({
    ...b,
    totalQuantity: b.stats?.totalQuantity ?? 0,
    quantityForTrade: b.stats?.quantityForTrade ?? 0,
    quantityNotForTrade: b.stats?.quantityNotForTrade ?? 0,
    totalValue: b.stats?.totalValue,
    valueForTrade: b.stats?.valueForTrade,
    valueNotForTrade: b.stats?.valueNotForTrade,
    rarityCounts: b.stats?.rarityCounts ?? {},
    rarityCountsForTrade: b.stats?.rarityCountsForTrade ?? {},
    rarityCountsNotForTrade: b.stats?.rarityCountsNotForTrade ?? {},
  }));

  return NextResponse.json({ binders });
}
