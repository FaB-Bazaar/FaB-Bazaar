import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/multi-auth";
import { wantsService, inventoryService } from "@/lib/services";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("targetUserId");

  if (!targetUserId) {
    return NextResponse.json({ cards_you_want: 0, target_has_wants: false });
  }

  // Always check if the target user has a wants list — this is public info
  // and determines whether we show the "Wants List" button at all.
  const targetWantsCountResult = await wantsService.countUserWants(targetUserId);
  const targetHasWants = targetWantsCountResult.success && targetWantsCountResult.data > 0;

  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ cards_you_want: 0, target_has_wants: targetHasWants });
  }

  const currentUserId = authResult.userId;

  const [wantsResult, tradeableResult] = await Promise.all([
    wantsService.getAllWantsForUser(currentUserId),
    inventoryService.getTradeableItems(targetUserId),
  ]);

  if (!wantsResult.success || !tradeableResult.success) {
    return NextResponse.json({ cards_you_want: 0, target_has_wants: targetHasWants });
  }

  const wantedPrintingIds = new Set(wantsResult.data.map(item => item.printingId));
  const tradeablePrintingIds = new Set(tradeableResult.data.map(item => item.printingId));

  let count = 0;
  for (const id of wantedPrintingIds) {
    if (tradeablePrintingIds.has(id)) {
      count++;
    }
  }

  return NextResponse.json({ cards_you_want: count, target_has_wants: targetHasWants });
}
