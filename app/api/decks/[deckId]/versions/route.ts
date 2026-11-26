import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { deckService } from "@/lib/services"
import { DECK_VERSION_NOT_EDITABLE } from "@/lib/deck/deck-versions"

type Context = { params: Promise<{ deckId: string }> }

/**
 * GET /api/decks/[deckId]/versions — the deck's saved versions, newest first,
 * without their cards. Owner or co-owner.
 */
export async function GET(request: NextRequest, { params }: Context) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true })
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { deckId } = await params
  const result = await deckService.listDeckVersions(deckId, authResult.userId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.error === DECK_VERSION_NOT_EDITABLE ? 403 : 500 })
  }

  return NextResponse.json({ success: true, data: { versions: result.data } })
}

/**
 * POST /api/decks/[deckId]/versions — save the deck's current cards as a new
 * version. Body: { label?: string } (an optional one-line note). Owner or
 * co-owner. 201 with the new version; 200 with `created: false` and the latest
 * version when the list has not changed since it was saved.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const body = await request.json().catch(() => null)
  const authResult = await authenticateRequest(request, body ?? {}, { allowOAuth: true })
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { deckId } = await params
  const result = await deckService.saveDeckVersion(deckId, authResult.userId, { label: body?.label })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.error === DECK_VERSION_NOT_EDITABLE ? 403 : 400 })
  }

  return NextResponse.json({ success: true, data: result.data }, { status: result.data.created ? 201 : 200 })
}
