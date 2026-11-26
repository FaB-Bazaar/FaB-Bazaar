import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { deckService } from "@/lib/services"
import { DECK_VERSION_NOT_EDITABLE } from "@/lib/deck/deck-versions"

/**
 * GET /api/decks/[deckId]/versions/[versionNumber] — one saved version with
 * its cards. Owner or co-owner.
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

  const result = await deckService.getDeckVersion(deckId, authResult.userId, number)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.error === DECK_VERSION_NOT_EDITABLE ? 403 : 500 })
  }
  if (!result.data) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { version: result.data } })
}
