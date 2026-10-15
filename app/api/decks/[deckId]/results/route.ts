import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService } from '@/lib/services';
import {
  deckFormatToCode,
  parseManualGame,
  resolveTalisharHeroId,
  type ManualGame,
  type ManualGameInput,
} from '@/lib/game-results/manual-game';

const MAX_GAMES_PER_REQUEST = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId } = await params;

    const deckLookup = await deckService.findByPublicId(publicId, authResult.userId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    const isCoOwner = (deckLookup.data.coOwners ?? []).includes(authResult.userId ?? '');
    if (deckLookup.data.userId?.toString() !== authResult.userId && !isCoOwner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const internalDeckId = deckLookup.data._id;
    const result = await gameResultsService.getGameResultsForDeck(internalDeckId, { limit, offset });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data.data, total: result.data.total });
  } catch (error) {
    console.error('[Deck Results] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Owner-only: log games by hand (played outside Talishar, or migrated from
// Fabrary) — the add_game_result MCP tool proxies here, hence allowOAuth.
// Body: one game, or { games: [...] }. The whole batch is validated first and
// nothing is written if any game is invalid. Re-logging a game is a no-op
// (reported as skipped). See lib/game-results/manual-game.ts for the fields.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // fall through to validation
    }

    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId } = await params;
    const deckLookup = await deckService.findByPublicId(publicId, authResult.userId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }
    const deck = deckLookup.data;
    if (deck.userId?.toString() !== authResult.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const rawGames: ManualGameInput[] = Array.isArray(body?.games) ? body.games : body && typeof body === 'object' && !('games' in body) ? [body] : [];
    if (rawGames.length === 0 || rawGames.length > MAX_GAMES_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `Send between 1 and ${MAX_GAMES_PER_REQUEST} games.` },
        { status: 400 }
      );
    }

    const defaultFormat = deckFormatToCode(deck.format);
    const parsed: ManualGame[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    rawGames.forEach((raw, index) => {
      const r = parseManualGame(raw ?? {}, { defaultFormat });
      if (r.ok) parsed.push(r.value);
      else errors.push({ index, error: r.error });
    });
    if (errors.length) {
      return NextResponse.json(
        { success: false, error: `${errors.length} of ${rawGames.length} games are invalid — nothing was saved.`, errors },
        { status: 400 }
      );
    }

    const playerHero = deck.heroName ? resolveTalisharHeroId(deck.heroName) : null;
    const results: Array<{ index: number; id: string; created: boolean }> = [];
    for (const [index, game] of parsed.entries()) {
      const r = await gameResultsService.createManualGameResult(deck._id, playerHero, game);
      if (!r.success) {
        return NextResponse.json(
          { success: false, error: r.error, saved: results },
          { status: 500 }
        );
      }
      results.push({ index, id: r.data.result.id, created: r.data.created });
    }

    const created = results.filter((r) => r.created).length;
    return NextResponse.json(
      { success: true, data: { created, skipped: results.length - created, results } },
      { status: created > 0 ? 201 : 200 }
    );
  } catch (error) {
    console.error('[Deck Results] Log game error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
