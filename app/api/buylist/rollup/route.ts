import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { printingsService, inventoryService } from "@/lib/services"
import {
  rollupBuylist,
  type BuylistSectionData,
  type BuylistPriceMap,
  type BuylistOwnedMap,
} from "@/lib/buylist/rollup"

// A buy list is authored by hand and can span a whole hero's card pool, but it
// is not unbounded — cap the lookup so a malformed section can't turn into a
// 10k-id query.
const MAX_CARDS = 500

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const tiers = body?.tiers
  if (!Array.isArray(tiers)) {
    return NextResponse.json({ error: "tiers must be an array" }, { status: 400 })
  }

  const section: BuylistSectionData = { tiers }

  const printingIds = [
    ...new Set(
      tiers.flatMap((tier: any) =>
        (tier?.groups ?? []).flatMap((group: any) =>
          (group?.cards ?? []).map((card: any) => card?.printingId).filter(Boolean)
        )
      )
    ),
  ] as string[]

  if (printingIds.length > MAX_CARDS) {
    return NextResponse.json(
      { error: `Too many cards in buy list (${printingIds.length} > ${MAX_CARDS})` },
      { status: 400 }
    )
  }

  if (printingIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: { rollup: rollupBuylist(section, { prices: {} }), cards: {}, authenticated: false },
    })
  }

  const printingsResult = await printingsService.getPrintingsByIds(printingIds)
  if (!printingsResult.success) {
    return NextResponse.json({ error: printingsResult.error }, { status: 500 })
  }

  const printings = printingsResult.data?.printings ?? []

  const prices: BuylistPriceMap = {}
  const cards: Record<string, unknown> = {}
  const cardUniqueIdByPrinting: Record<string, string> = {}

  for (const p of printings) {
    prices[p.printing_id] = { tcg_low: p.tcg_low, tcg_market: p.tcg_market }
    if (p.card_unique_id) cardUniqueIdByPrinting[p.printing_id] = p.card_unique_id
    cards[p.printing_id] = {
      printing_id: p.printing_id,
      card_unique_id: p.card_unique_id,
      name: p.name,
      collector_number: p.collector_number,
      set: p.set,
      foiling: p.foiling,
      // Always the stored CDN url — ids derive from printing characteristics,
      // so a url built from printing_id would 404.
      image_url: p.image_url,
      tcg_low: p.tcg_low,
      tcg_market: p.tcg_market,
    }
  }

  // Optional auth: this powers a public article component, so a signed-out
  // reader gets prices without an ownership overlay rather than a 401.
  const authResult = await authenticateRequest(request, {})
  const authenticated = authResult.success === true

  let owned: BuylistOwnedMap | undefined
  if (authenticated && authResult.userId) {
    const cardUniqueIds = [...new Set(Object.values(cardUniqueIdByPrinting))]
    // Ownership is counted per CARD, not per printing: a reader holding the
    // rainbow foil already owns the card and should not be told to buy it.
    const ownedResult = await inventoryService.getOwnedCountsByCardUniqueId(
      authResult.userId,
      cardUniqueIds
    )
    if (ownedResult.success) {
      const byCard = ownedResult.data ?? {}
      owned = {}
      for (const [printingId, cardUniqueId] of Object.entries(cardUniqueIdByPrinting)) {
        const count = byCard[cardUniqueId]
        if (count) owned[printingId] = count
      }
    }
  }

  let rollup
  try {
    rollup = rollupBuylist(section, { prices, owned })
  } catch (e) {
    // parseQuantity throws on author error — that is a bad request, not a bug.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid buy list" },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, data: { rollup, cards, authenticated } })
}
