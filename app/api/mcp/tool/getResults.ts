// app/api/mcp/tool/getResults.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { resolveOwnedDeck } from './listResults';
import { renderGameText } from '@/lib/talishar/renderGameText';
import { renderCardGlossary, type CardMeta } from '@/lib/talishar/renderCardGlossary';
import { getHeroPrimer } from '@/lib/fab-constants/hero-strategy';
import type { RawGamePayload } from '@/lib/talishar/analyzeGame';

// Curated hero game-plan primers for whichever heroes we have them for.
function buildHeroPlans(payload: RawGamePayload): string {
  const lines: string[] = [];
  const you = getHeroPrimer((payload.self as any)?.playerHero);
  const opp = getHeroPrimer((payload.opponent as any)?.playerHero);
  if (you) lines.push(`YOUR HERO —\n${you}`);
  if (opp) lines.push(`OPPONENT HERO —\n${opp}`);
  if (lines.length === 0) return '';
  return `Hero game plans (curated — treat as authoritative for what the deck wants to do):\n\n${lines.join('\n\n')}`;
}

// Strategic framework appended to every game so the model coaches like a FaB
// player instead of pattern-matching surface stats. These are general concepts —
// not game-specific claims.
const COACHING_LENS = `Coaching lens — apply these when analyzing (general FaB concepts, not claims about this game):
- Hero game plan: first state what THIS deck is trying to do (win condition + engine + the synergies in the glossary), then judge each turn against that plan.
- Value vs. tempo: value/turn is potential; dealt/turn is realized. A big gap means value went to blocks/pitch instead of the opponent — that can be correct defense, not automatically a misplay.
- Pivot turns: find where momentum flips (use the per-turn life + damage numbers). A player usually CHOOSES to take damage on the turn(s) BEFORE a pivot to set up a bigger swing — a big damage-taken turn followed by a big value turn is often a deliberate plan, not an error.
- Draw variance vs. misplay: never fault a card that wasn't drawn or wasn't playable yet. The log shows what was played, not the hand — separate "rough draw" from "wrong decision," and say which you can't tell.
- Pitch & sequencing: cards pitched set up future turns; look at what was pitched to enable what.
- Trends, not just totals: read life totals and threatened/dealt across turns to find where the game was actually decided.
- Be honest about limits: no hands/draws are logged. Flag reads that depend on info you don't have, and ask the player.
- Use Flesh and Blood terms ONLY — never Magic: The Gathering vocabulary. There is no "mana"; resources come from pitching cards (talk in "resources"/"pitch"). Other FaB terms: arsenal (not "exile"/"hand zone"), go again, pitch (red 1 / yellow 2 / blue 3), defense reaction, on-hit, attack reaction.`;

// Every distinct Talishar card id referenced anywhere in the game (both
// players' decks, arena/tokens, loadout, and the turn log).
function collectCardIds(payload: RawGamePayload): string[] {
  const ids = new Set<string>();
  const addCards = (arr?: unknown) => {
    if (Array.isArray(arr)) for (const c of arr) if (typeof (c as any)?.cardId === 'string') ids.add((c as any).cardId);
  };
  const addLog = (log?: unknown) => {
    if (Array.isArray(log)) for (const e of log) if (Array.isArray(e) && typeof e[1] === 'string') ids.add(e[1]);
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
  return [...ids];
}

// Resolve every card to its semantics (type/keywords/stats/text) server-side so
// the model never has to call search_printings itself. Best-effort.
async function buildGlossary(apiBase: string, payload: RawGamePayload): Promise<string> {
  try {
    const ids = collectCardIds(payload);
    if (ids.length === 0) return '';
    const res = await mcpFetch(`${apiBase}/api/cards/by-talishar-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, details: true }),
    });
    if (!res.ok) return '';
    const body = await res.json();
    const cards: CardMeta[] = Object.values(body.data || {}).map((c: any) => ({
      name: c.displayName,
      pitch: c.pitch,
      typeText: c.typeText,
      cost: c.cost,
      power: c.power,
      defense: c.defense,
      keywords: c.keywords,
      text: c.text,
    }));
    return renderCardGlossary(cards);
  } catch {
    return '';
  }
}

export const getResultsTool = {
  name: 'get_results',
  description: `📊 GET FULL GAME DATA: the complete raw game blob for one recorded game.

  Returns a READABLE turn-by-turn rendering (card names + what each player did,
  in exact order) plus the complete uncurated raw blob in the data field for
  anything deeper. Read the message text to coach on specific turns.

  Defaults to your MOST RECENT game with the deck (covers "show me my last game of deck X").
  To pick a specific game, call list_results first and pass its gameNumber or resultId.

  🔒 Your own games only.  ⚠️ Large response (~10KB) — only call when the user wants the full detail.

  📋 CALL FORMAT — last game:   { "deckName": "Dash Nitro Mechanoid" }
  📋 CALL FORMAT — pick one:    { "deckName": "Dash Nitro Mechanoid", "gameNumber": 2 }
  📋 CALL FORMAT — by id:       { "deckName": "Dash Nitro Mechanoid", "resultId": "<id from list_results>" }`,

  parameters: {
    type: 'object',
    properties: {
      deckName: { type: 'string', description: 'Name of the deck (case-insensitive exact match).' },
      gameNumber: { type: 'number', description: 'Which game from list_results (1 = most recent). Defaults to 1.' },
      resultId: { type: 'string', description: 'Exact result id from list_results. Overrides gameNumber.' },
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

      // Resolve which game: explicit resultId wins; otherwise the Nth most recent.
      let resultId: string | undefined = params?.resultId;
      if (!resultId) {
        const gameNumber = Math.max(parseInt(String(params.gameNumber ?? 1), 10) || 1, 1);
        const listRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/results?limit=${gameNumber}&offset=0`, {
          method: 'GET',
          headers,
        });
        if (!listRes.ok) return { success: false, error: `Failed to fetch results (HTTP ${listRes.status}).` };
        const listBody = await listRes.json();
        if (!listBody.success) return { success: false, error: listBody.error || 'Could not load results.' };
        const games: any[] = listBody.data || [];
        if (games.length === 0) {
          return { success: true, message: `📭 No recorded games for "${deck.name}".`, data: null };
        }
        const pick = games[gameNumber - 1];
        if (!pick) {
          return {
            success: false,
            error: `Only ${games.length} game(s) recorded for "${deck.name}"; gameNumber ${gameNumber} is out of range. Use list_results to see what's available.`,
          };
        }
        resultId = pick.id;
      }

      const rawRes = await mcpFetch(
        `${API_BASE_URL}/api/decks/${deck.publicId}/results/${resultId}/raw?shape=raw`,
        { method: 'GET', headers }
      );
      if (!rawRes.ok) return { success: false, error: `Failed to fetch game data (HTTP ${rawRes.status}).` };
      const rawBody = await rawRes.json();
      if (!rawBody.success) return { success: false, error: rawBody.error || 'Could not load game data.' };
      if (!rawBody.data) {
        return {
          success: true,
          message: `No detailed archive is stored for this game (only games recorded after archiving was enabled have one).`,
          data: null,
        };
      }

      // Render the blob as readable, name-resolved turn-by-turn text so the
      // model reads prose (not raw [turn, slug, action] tuples). The full raw
      // blob is still returned in `data` for anything deeper.
      let readable: string;
      try {
        readable = renderGameText(rawBody.data as RawGamePayload);
      } catch {
        readable = `Full game data for "${deck.name}" (result ${resultId}).`;
      }

      // Append a card glossary (what each card does) resolved server-side.
      const glossary = await buildGlossary(API_BASE_URL, rawBody.data as RawGamePayload);
      // Curated hero game-plan context (game plan first, before the turn-by-turn).
      const heroPlans = buildHeroPlans(rawBody.data as RawGamePayload);

      const parts = [
        `📊 **${deck.name}** — game ${resultId}`,
        heroPlans,
        readable,
        glossary,
        COACHING_LENS,
      ].filter(Boolean);

      return {
        success: true,
        message: parts.join('\n\n'),
        deckName: deck.name,
        resultId,
        data: rawBody.data,
      };
    } catch (error) {
      console.error('[GetResults] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  },
};
