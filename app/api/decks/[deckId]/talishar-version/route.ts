import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { deckService } from "@/lib/services"
import { deckVersionFailure } from "@/lib/deck/deck-versions"

/**
 * PUT /api/decks/[deckId]/talishar-version — pick the list Talishar imports
 * for this deck. Body: { versionNumber: number | null } — a saved version's
 * number, or null for the deck as it is now. Owner or co-owner.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const body = await request.json().catch(() => null)
  const authResult = await authenticateRequest(request, body ?? {}, { allowOAuth: true })
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const versionNumber = body && typeof body === "object" ? (body as { versionNumber?: unknown }).versionNumber : undefined
  const valid = versionNumber === null
    || (typeof versionNumber === "number" && Number.isInteger(versionNumber) && versionNumber >= 1 && versionNumber <= 999_999_999)
  if (!valid) {
    return NextResponse.json({ error: "versionNumber must be a saved version's number, or null for the current deck" }, { status: 400 })
  }

  const { deckId } = await params
  const result = await deckService.setTalisharVersion(deckId, authResult.userId, versionNumber as number | null)
  if (!result.success) {
    const failure = deckVersionFailure(result.error)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }

  return NextResponse.json({ success: true, data: result.data })
}
