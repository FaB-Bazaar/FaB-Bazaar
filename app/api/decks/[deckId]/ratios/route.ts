import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { deckService } from "@/lib/services"
import { sanitizeRatios } from "@/lib/deck/ratios"

/**
 * PUT /api/decks/[deckId]/ratios — replace the deck's saved ratios
 * (deck v2 Stats panel). Body: { ratios: DeckRatio[] }. Owner or co-owner.
 * Entries are validated/trimmed (sanitizeRatios); junk entries are dropped.
 * Only metadata.ratios is written — matchups and other metadata are untouched.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const body = await request.json().catch(() => null)
  const authResult = await authenticateRequest(request, body ?? {}, { allowOAuth: true })
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const ratios = sanitizeRatios(body?.ratios)
  if (!ratios) {
    return NextResponse.json({ error: "ratios must be a list" }, { status: 400 })
  }

  const { deckId } = await params
  const result = await deckService.setDeckRatios(deckId, authResult.userId, ratios)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }

  return NextResponse.json({ success: true, data: result.data })
}
