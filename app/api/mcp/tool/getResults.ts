// app/api/mcp/tool/getResults.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { resolveOwnedDeck } from './listResults';
import { renderGameText } from '@/lib/talishar/renderGameText';
import { renderCardGlossary, type CardMeta } from '@/lib/talishar/renderCardGlossary';
import { getHeroPrimer } from '@/lib/fab-constants/hero-strategy';
import type { RawGamePayload } from '@/lib/talishar/analyzeGame';

const MAX_BATCH = 5;

function titleCase(slug?: string | null): string {
  if (!slug) return 'Opponent';
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// The player's OWN notes (game plan + per-card notes + the matchup note(s) for
// the opponent hero(es) in this batch). Most personal context.
// Returns the deck-level notes TEXT (game plan + matchup notes for this batch's
// opponents) AND the raw per-card notes map. Per-card notes are NOT emitted as a
// section here — they're merged onto the matching glossary lines instead (no
// redundant duplication).
async function buildDeckContext(
  apiBase: string,
  token: string,
  publicId: string,
  opponentHeroes: string[]
): Promise<{ notesText: string; cardNotes: Record<string, string> }> {
  try {
    const res = await mcpFetch(`${apiBase}/api/decks/${publicId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { notesText: '', cardNotes: {} };
    const body = await res.json();
    const meta = body?.data?.metadata ?? {};
    const cardNotes: Record<string, string> =
      meta.cardNotes && typeof meta.cardNotes === 'object' ? meta.cardNotes : {};
    const sections: string[] = [];

    const gamePlan = typeof meta.gamePlan === 'string' ? meta.gamePlan.trim() : '';
    const desc = typeof body?.data?.description === 'string' ? body.data.description.trim() : '';
    const plan = gamePlan || desc;
    if (plan) sections.push(`Player's own deck notes (their stated game plan — weigh the analysis against THIS):\n${plan}`);

    // Matchup note(s) the player wrote for the opponent hero(es) in this batch.
    const matchupNotes = meta.matchupNotes;
    if (matchupNotes && typeof matchupNotes === 'object') {
      const lines = opponentHeroes
        .map((h) => {
          const note = (matchupNotes as Record<string, unknown>)[h];
          return typeof note === 'string' && note.trim() ? `vs ${titleCase(h)}: ${note.trim()}` : null;
        })
        .filter((x): x is string => !!x);
      if (lines.length) sections.push(`Player's matchup notes (their own plan for THIS opponent):\n${lines.join('\n\n')}`);
    }

    return { notesText: sections.join('\n\n'), cardNotes };
  } catch {
    return { notesText: '', cardNotes: {} };
  }
}

// Curated hero game-plan primers across all heroes in the batch (your hero once,
// each distinct opponent once).
function buildHeroPlans(blobs: RawGamePayload[]): string {
  const lines: string[] = [];
  const selfHero = blobs.map((b) => (b.self as any)?.playerHero).find(Boolean);
  const youPrimer = getHeroPrimer(selfHero);
  if (youPrimer) lines.push(`YOUR HERO —\n${youPrimer}`);

  const oppHeroes = [...new Set(blobs.map((b) => (b.opponent as any)?.playerHero).filter(Boolean) as string[])];
  for (const oh of oppHeroes) {
    const p = getHeroPrimer(oh);
    if (p) lines.push(`OPPONENT HERO (${titleCase(oh)}) —\n${p}`);
  }
  if (lines.length === 0) return '';
  return `Hero game plans (curated — treat as authoritative for what the deck wants to do):\n\n${lines.join('\n\n')}`;
}

const COACHING_LENS = `Coaching lens — apply these when analyzing (general FaB concepts, not claims about this game):
- Hero game plan: first state what THIS deck is trying to do (win condition + engine + the synergies in the glossary), then judge each turn against that plan.
- Value vs. tempo: value/turn is potential; dealt/turn is realized. A big gap means value went to blocks/pitch instead of the opponent — that can be correct defense, not automatically a misplay.
- Pivot turns: find where momentum flips (use the per-turn life + damage numbers). A player usually CHOOSES to take damage on the turn(s) BEFORE a pivot to set up a bigger swing — a big damage-taken turn followed by a big value turn is often a deliberate plan, not an error.
- Draw variance vs. misplay: never fault a card that wasn't drawn or wasn't playable yet. The log shows what was played, not the hand — separate "rough draw" from "wrong decision," and say which you can't tell.
- Pitch & sequencing: cards pitched set up future turns; look at what was pitched to enable what.
- Trends, not just totals: read life totals and threatened/dealt across turns to find where the game was actually decided. Across multiple games, look for what differs between wins and losses.
- Be honest about limits: no hands/draws are logged. Flag reads that depend on info you don't have, and ask the player.
- Use Flesh and Blood terms ONLY — never Magic: The Gathering vocabulary. There is no "mana"; resources come from pitching cards. Other FaB terms: arsenal, go again, pitch (red 1 / yellow 2 / blue 3), defense reaction, on-hit, attack reaction.`;

// Every distinct Talishar card id referenced anywhere in a game.
function collectCardIds(payload: RawGamePayload, into: Set<string>): void {
  const addCards = (arr?: unknown) => {
    if (Array.isArray(arr)) for (const c of arr) if (typeof (c as any)?.cardId === 'string') into.add((c as any).cardId);
  };
  const addLog = (log?: unknown) => {
    if (Array.isArray(log)) for (const e of log) if (Array.isArray(e) && typeof e[1] === 'string') into.add(e[1]);
  };
  for (const side of [payload.self, payload.opponent]) {
    if (!side) continue;
    const s = side as Record<string, unknown>;
    addCards(s.cardResults);
    addCards(s.arenaCardResults);
    addCards(s.tokenResults);
    addCards(s.character);
    addLog(s.turnLog);
  }
}

// Compact card list for the CHAT UI (structured, not for the model): name +
// representative printing + image, the shape harvestCardsFromStructured reads
// to linkify card names in the analysis and wire hover previews.
interface StructuredGameCard {
  name: string;
  pitch?: number;
  printing_id: string;
  image_url?: string;
}

// One glossary covering every card across all games in the batch (deduped). The
// by-talishar-id endpoint is public, so no auth header is needed. Best-effort.
async function buildGlossary(
  apiBase: string,
  blobs: RawGamePayload[],
  cardNotes?: Record<string, string>,
): Promise<{ glossary: string; structuredCards: StructuredGameCard[] }> {
  try {
    const idSet = new Set<string>();
    for (const b of blobs) collectCardIds(b, idSet);
    const ids = [...idSet];
    if (ids.length === 0) return { glossary: '', structuredCards: [] };
    const res = await mcpFetch(`${apiBase}/api/cards/by-talishar-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, details: true }),
    });
    if (!res.ok) return { glossary: '', structuredCards: [] };
    const body = await res.json();
    const rows: any[] = Object.values(body.data || {});
    const cards: CardMeta[] = rows.map((c: any) => ({
      name: c.displayName,
      pitch: c.pitch,
      typeText: c.typeText,
      cost: c.cost,
      power: c.power,
      defense: c.defense,
      keywords: c.keywords,
      text: c.text,
    }));
    const seen = new Set<string>();
    const structuredCards: StructuredGameCard[] = [];
    for (const c of rows) {
      if (!c.displayName || !c.printingId || seen.has(c.printingId)) continue;
      seen.add(c.printingId);
      structuredCards.push({
        name: c.displayName,
        ...(typeof c.pitch === 'number' && c.pitch > 0 ? { pitch: c.pitch } : {}),
        printing_id: c.printingId,
        ...(c.imageUrl ? { image_url: c.imageUrl } : {}),
      });
    }
    return { glossary: renderCardGlossary(cards, cardNotes), structuredCards };
  } catch {
    return { glossary: '', structuredCards: [] };
  }
}

export const getResultsTool = {
  name: 'get_results',
  description: `📊 GET FULL GAME DATA: readable turn-by-turn for one OR several recorded games.

  Returns a readable, name-resolved turn-by-turn for each game, plus shared
  context sent ONCE (your deck/card notes, curated hero game plans, a card
  glossary of what each card does, and a coaching lens). Read the message to coach.

  Single game defaults to your MOST RECENT. To analyze a MATCHUP, call list_results
  with opponentHero to get the resultIds, then pass them here as resultIds (max ${MAX_BATCH})
  — the glossary/primers/notes aren't repeated per game, so it stays compact.

  🔒 Your own games only.
  ⚠️ resultId / resultIds come from list_results — NOT from a deck's /decks/<id> URL
  (that's the DECK id and will return "no archive"). Don't know which deck? Call
  list_results with NO deckName to see recent games across all decks, pick one, then
  pass its deckName + resultId here.

  📋 last game:   { "deckName": "Dash Nitro Mechanoid" }
  📋 one game:    { "deckName": "Dash Nitro Mechanoid", "resultId": "<id>" }
  📋 a matchup:   { "deckName": "Dash Nitro Mechanoid", "resultIds": ["<id1>","<id2>","<id3>"] }`,

  parameters: {
    type: 'object',
    properties: {
      deckName: { type: 'string', description: 'Name of the deck (case-insensitive exact match).' },
      resultIds: {
        type: 'array',
        items: { type: 'string' },
        description: `Up to ${MAX_BATCH} result ids (from list_results) to pull together for matchup/cross-game analysis. For more, make separate calls.`,
      },
      gameNumber: { type: 'number', description: 'Which single game from list_results (1 = most recent). Defaults to 1.' },
      resultId: { type: 'string', description: 'A single exact result id (from list_results).' },
    },
    required: ['deckName'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) return { success: false, error: 'Authentication failed: No token was found.' };

      const deckName = params?.deckName;
      if (!deckName) return { success: false, error: 'deckName is required.' };

      const deck = await resolveOwnedDeck(API_BASE_URL, tokenToUse, deckName);
      if (!deck.ok) return { success: false, error: deck.error };

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` };

      // Resolve which game(s): resultIds array (batch) > single resultId > Nth most recent.
      const isBatch = Array.isArray(params?.resultIds) && params.resultIds.length > 0;
      let resultIds: string[];
      if (isBatch) {
        resultIds = params.resultIds.filter((x: any) => typeof x === 'string' && x).slice(0, MAX_BATCH);
        if (resultIds.length === 0) return { success: false, error: 'resultIds must contain at least one result id.' };
      } else if (params?.resultId) {
        resultIds = [String(params.resultId)];
      } else {
        const gameNumber = Math.max(parseInt(String(params.gameNumber ?? 1), 10) || 1, 1);
        const listRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/results?limit=${gameNumber}&offset=0`, { method: 'GET', headers });
        if (!listRes.ok) return { success: false, error: `Failed to fetch results (HTTP ${listRes.status}).` };
        const listBody = await listRes.json();
        if (!listBody.success) return { success: false, error: listBody.error || 'Could not load results.' };
        const games: any[] = listBody.data || [];
        if (games.length === 0) return { success: true, message: `📭 No recorded games for "${deck.name}".`, data: null };
        const pick = games[gameNumber - 1];
        if (!pick) return { success: false, error: `Only ${games.length} game(s) recorded for "${deck.name}"; gameNumber ${gameNumber} is out of range.` };
        resultIds = [pick.id];
      }

      // Fetch each game's raw blob.
      const fetched: { resultId: string; blob: RawGamePayload }[] = [];
      for (const id of resultIds) {
        const rawRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/results/${id}/raw?shape=raw`, { method: 'GET', headers });
        if (!rawRes.ok) continue;
        const rawBody = await rawRes.json();
        if (rawBody?.success && rawBody.data) fetched.push({ resultId: id, blob: rawBody.data as RawGamePayload });
      }
      if (fetched.length === 0) {
        return { success: true, message: `No detailed archive is stored for the requested game(s).`, data: null };
      }

      const blobs = fetched.map((f) => f.blob);
      const single = fetched.length === 1 && !isBatch;
      const oppHeroes = [...new Set(blobs.map((b) => (b.opponent as any)?.playerHero).filter(Boolean) as string[])];

      // Shared context — built ONCE for the whole batch.
      const { notesText: deckNotes, cardNotes } = await buildDeckContext(API_BASE_URL, tokenToUse, deck.publicId, oppHeroes);
      const heroPlans = buildHeroPlans(blobs);
      const { glossary, structuredCards } = await buildGlossary(API_BASE_URL, blobs, cardNotes);

      // Per-game readable turn-by-turn.
      const gameSections = fetched.map((f, i) => {
        let text: string;
        try {
          text = renderGameText(f.blob);
        } catch {
          text = `(could not render game ${f.resultId})`;
        }
        return single ? text : `=== Game ${i + 1} (result ${f.resultId}) ===\n${text}`;
      });

      const title = single
        ? `📊 **${deck.name}** — game ${fetched[0].resultId}`
        : `📊 **${deck.name}** — ${fetched.length} games (shared context once, then each game)`;

      const message = [title, deckNotes, heroPlans, glossary, ...gameSections, COACHING_LENS].filter(Boolean).join('\n\n');

      return {
        success: true,
        message,
        deckName: deck.name,
        resultIds: fetched.map((f) => f.resultId),
        // Structured (UI-only, zero model tokens): every card in the game with
        // its representative printing — the chat harvests this to linkify card
        // names in the analysis and wire hover previews.
        ...(structuredCards.length ? { cards: structuredCards } : {}),
        // The readable message already encodes the whole game (turn-by-turn +
        // glossary + notes), so the raw blob is NOT inlined — it's ~16k redundant
        // tokens. Fetch it via GET /api/decks/[id]/results/[resultId]/raw?shape=raw
        // if the unprocessed Talishar payload is ever needed.
        data: null,
      };
    } catch (error) {
      console.error('[GetResults] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  },
};
