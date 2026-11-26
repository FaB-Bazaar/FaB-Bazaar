import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { deckService } from "@/lib/services"
import { deckVersionFailure } from "@/lib/deck/deck-versions"

/**
 * GET /api/decks/[deckId]/versions/[versionNumber]/deck — one saved version in
 * the shape the deck page renders (cards in their zones with card details).
 * Owner or co-owner. Read only.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ deckId: string; versionNumber: string }> }) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true })
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { deckId, versionNumber } = await params
  const number = /^[1-9]\d{0,8}$/.test(versionNumber) ? Number(versionNumber) : null
  if (number === null) {
    return NextResponse.json({ error: "versionNumber must be a positive whole number" }, { status: 400 })
  }

  const result = await deckService.getDeckVersionAsDeck(deckId, authResult.userId, number)
  if (!result.success) {
    const failure = deckVersionFailure(result.error)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }
  if (!result.data) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { deck: result.data } })
}
