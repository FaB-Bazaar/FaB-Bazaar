// app/api/mcp/tool/saveDeckMatchup.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { buildMatchupPool, computeLineupSwaps, type LineupEntry, type LineupResult } from '@/lib/deck/matchup-lineup';

export const saveDeckMatchupTool = {
  name: 'save_deck_matchup',
  description: `⚔️ SAVE DECK MATCHUP: Create or update a sideboard plan for a specific opponent hero

  📖 PREREQUISITE: Read resource fab://hero-ids to get the full list of valid heroId values before calling this tool.

  Saves a matchup configuration to a deck: which cards to swap in/out against a specific hero,
  preferred turn order, and strategy notes.

  ✅ PREFERRED — LINEUP MODE (declarative, mirrors the tile editor):
  Pass \`lineup\`: the COMPLETE active list for this matchup — every library + equipment card
  that stays in (un-greyed), with quantities. The tool fetches the deck, treats
  hero + equipment + maindeck + inventory (the sideboard) as the card pool, and computes
  sideboardIn/sideboardOut for you: anything in the pool you DON'T list is sided out (greyed);
  inventory cards you list are sided in. The hero is never sided. Nothing about the deck's
  cards is modified — only the matchup plan. Cards not in the pool are an ERROR (add them to
  the inventory first with add_cards_to_deck { category: "inventory" }); asking for more copies
  than the pool holds is an ERROR. Set \`dryRun: true\` to preview the computed swaps + stats
  without saving.
    {
      deckName: "slab maxx", heroId: "arakni_marionette", preferredTurnOrder: "Second",
      lineup: [
        { cardName: "Command and Conquer", pitch: 1, quantity: 3 },
        { cardName: "Sink Below", pitch: 3, quantity: 3 },
        { cardName: "Adaptive Alpha Mold", quantity: 1 },
        ...every other active card...
      ]
    }
  ⚠️ lineup is the WHOLE active list — send 30 cards and the other 30 get benched. Read the
  returned diff/stats. lineup cannot be combined with sideboardIn/sideboardOut.

  LEGACY — DELTA MODE: pass sideboardIn / sideboardOut directly (Talishar ids, one per copy).

  Use heroId "core" for a special baseline/stripped-down list configuration (no specific opponent).
  Use heroId "aggro", "fatigue", "combo", or "midrange" for archetype/strategy-based matchup plans.

  💡 WORKFLOW:
  Step 1: get_deck — view the decklist (maindeck cards can go in "out", inventory/sideboard cards go in "in")
  Step 2: save_deck_matchup — save the sideboard plan

  📦 HERO IDs use Talishar format (lowercase, underscores):
  Examples: "briar_warden_of_thorns", "fai_rising_rebellion", "iyslander_stormbind"
  Special:  "core" — baseline list (no opponent hero)
            "aggro", "fatigue", "combo", "midrange" — archetype matchup plans

  📖 EXAMPLE:
  {
    deckName: "My Deck",
    heroId: "briar_warden_of_thorns",
    preferredTurnOrder: "Second",
    notes: "Defend early aggression, watch for Embodiment of Earth",
    sideboardIn: ["unmovable_red", "unmovable_red"],
    sideboardOut: ["pummel_red", "pummel_yellow"]
  }

  ⚠️ CRITICAL — sideboardIn and sideboardOut MUST be arrays of card ID strings, NOT prose text:
  ✅ CORRECT:   sideboardOut: ["pummel_red", "pummel_yellow"]
  ❌ WRONG:     sideboardOut: "-1x Pummel (red), -1x Pummel (yellow)"   ← never do this
  ❌ WRONG:     notes: "-2x Pummel, +1x Sink Below"                     ← notes is for strategy text only

  Card IDs use Talishar format: "{card_name}_{pitch_color}"
  e.g. "sink_below_red", "pummel_yellow", "command_and_conquer_blue"
  Non-pitched cards use just the name: "fyendal_spring_tunic"
  Repeat an ID multiple times to include multiple copies: ["pummel_red", "pummel_red"] = 2× Pummel (red)

  If a matchup for this heroId already exists it will be updated (not duplicated).`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'Name of the deck (case-insensitive match)'
      },
      heroId: {
        type: 'string',
        description: 'Opponent hero in Talishar format (e.g. "briar_warden_of_thorns"), or one of the special strategy identifiers: "core" (baseline list), "aggro", "fatigue", "combo", "midrange"'
      },
      preferredTurnOrder: {
        type: 'string',
        enum: ['First', 'Second', 'NoPreference'],
        description: 'Preferred turn order for this matchup'
      },
      notes: {
        type: 'string',
        description: 'Strategy notes for this matchup (max 500 characters). Plain text only — do NOT put card lists here; use sideboardIn/sideboardOut for card swaps.'
      },
      sideboardIn: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of card IDs to bring IN from inventory (Talishar format). Each element is one copy — repeat to include multiples: ["pummel_red","pummel_red"] = 2 copies. MUST be an array, never a string.'
      },
      sideboardOut: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of card IDs to take OUT of the main deck (Talishar format). Each element is one copy — repeat to include multiples. MUST be an array, never a string.'
      },
      lineup: {
        type: 'array',
        description: 'LINEUP MODE: the complete ACTIVE list for this matchup (library + equipment; hero optional). Unlisted pool cards are sided out; listed inventory cards are sided in. Mutually exclusive with sideboardIn/sideboardOut.',
        items: {
          type: 'object',
          properties: {
            cardName: { type: 'string', description: 'Card name (e.g. "Sink Below"). Combine with pitch.' },
            pitch: { type: 'number', enum: [0, 1, 2, 3], default: 0, description: '0 = unpitched (equipment, heroes), 1 red, 2 yellow, 3 blue' },
            cardId: { type: 'string', description: 'Alternative to cardName+pitch: raw Talishar id (e.g. "sink_below_blue")' },
            quantity: { type: 'number', default: 1, description: 'Active copies of this card in the matchup' }
          }
        }
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Lineup mode only: compute the swaps + stats and return them WITHOUT saving.'
      }
    },
    required: ['deckName', 'heroId']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token found.' };
      }

      const {
        deckName,
        heroId: rawHeroId,
        preferredTurnOrder = null,
        notes: rawNotes = null,
        sideboardIn: rawSideboardIn = [],
        sideboardOut: rawSideboardOut = [],
        lineup: rawLineup,
        dryRun = false,
      } = params;

      if (!deckName) return { success: false, error: 'deckName is required.' };
      if (!rawHeroId) return { success: false, error: 'heroId is required.' };

      const lineupMode = Array.isArray(rawLineup);
      const hasDelta = (Array.isArray(rawSideboardIn) && rawSideboardIn.length > 0)
        || (Array.isArray(rawSideboardOut) && rawSideboardOut.length > 0)
        || (typeof rawSideboardIn === 'string' && rawSideboardIn.trim())
        || (typeof rawSideboardOut === 'string' && rawSideboardOut.trim());
      if (lineupMode && hasDelta) {
        return { success: false, error: 'Pass EITHER lineup (the full active list) OR sideboardIn/sideboardOut — not both.' };
      }
      if (lineupMode && rawLineup.length === 0) {
        return { success: false, error: 'lineup is empty. Pass the complete active list for this matchup (or use sideboardIn/sideboardOut).' };
      }

      // Normalize and validate heroId — only lowercase letters, digits, underscores allowed
      const heroId = String(rawHeroId).toLowerCase().trim();
      if (!/^[a-z0-9_]+$/.test(heroId)) {
        return { success: false, error: `Invalid heroId "${rawHeroId}". Use lowercase letters, numbers, and underscores only (e.g. "briar_warden_of_thorns", "aggro").` };
      }

      // Normalize sideboardIn/Out — coerce comma-separated strings into arrays, then sanitize each ID
      const normalizeCardList = (raw: unknown): string[] => {
        if (typeof raw === 'string' && raw.trim()) {
          return raw.split(',').map(s => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
        }
        if (Array.isArray(raw)) {
          return raw.map(s => String(s).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
        }
        return [];
      };
      let sideboardIn = normalizeCardList(rawSideboardIn);
      let sideboardOut = normalizeCardList(rawSideboardOut);

      // Truncate notes to 500 chars
      const notes = rawNotes ? String(rawNotes).slice(0, 500) : null;

      // Validate valid turn order value
      const validTurnOrders = [null, 'First', 'Second', 'NoPreference'];
      const turnOrder = validTurnOrders.includes(preferredTurnOrder) ? preferredTurnOrder : null;

      // Resolve deck by name
      const listRes = await mcpFetch(`${API_BASE_URL}/api/decks?limit=100`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });
      if (!listRes.ok) return { success: false, error: `Failed to fetch deck list (HTTP ${listRes.status}).` };
      const listData = await listRes.json();
      if (!listData.success) return { success: false, error: listData.error || 'Could not load deck list.' };

      const deck = (listData.decks || []).find((d: any) => d.name?.toLowerCase() === deckName.toLowerCase());
      if (!deck) {
        const available = (listData.decks || []).map((d: any) => d.name).join(', ');
        return { success: false, error: `No deck named "${deckName}" found. Available: ${available}` };
      }

      // Validate publicId is safe before using in URL path
      const publicId = String(deck.publicId || '');
      if (!/^[a-zA-Z0-9_-]+$/.test(publicId)) {
        return { success: false, error: 'Unexpected deck ID format.' };
      }

      // ── Lineup mode: fetch the deck, build the pool, derive in/out ──────────
      let lineupResult: LineupResult | null = null;
      if (lineupMode) {
        const deckRes = await mcpFetch(`${API_BASE_URL}/api/decks/${publicId}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
        });
        if (!deckRes.ok) return { success: false, error: `Failed to fetch deck "${deck.name}" (HTTP ${deckRes.status}).` };
        const deckData = await deckRes.json();
        if (!deckData.success || !deckData.data) return { success: false, error: deckData.error || 'Could not load the deck.' };

        const pool = buildMatchupPool(deckData.data);
        const entries: LineupEntry[] = rawLineup.map((e: any) => ({
          cardName: typeof e?.cardName === 'string' ? e.cardName : undefined,
          cardId: typeof e?.cardId === 'string' ? e.cardId : undefined,
          pitch: typeof e?.pitch === 'number' ? e.pitch : 0,
          quantity: typeof e?.quantity === 'number' && e.quantity >= 0 ? Math.floor(e.quantity) : 1,
        }));
        lineupResult = computeLineupSwaps(pool, entries);
        if (!lineupResult.ok) {
          return {
            success: false,
            error: `Lineup not applied — fix these and retry:\n${lineupResult.errors.map(e => `  - ${e}`).join('\n')}`,
            errors: lineupResult.errors,
          };
        }
        sideboardIn = lineupResult.in;
        sideboardOut = lineupResult.out;

        if (dryRun) {
          return {
            success: true,
            dryRun: true,
            message: `DRY RUN — nothing saved.\n${formatLineupSummary(lineupResult)}`,
            deckName: deck.name,
            publicId,
            heroId,
            sideboard: { in: sideboardIn, out: sideboardOut },
            changes: lineupResult.changes,
            stats: lineupResult.stats,
          };
        }
      }

      const matchupPayload = {
        matchup: {
          heroId,
          preferredTurnOrder: turnOrder,
          notes,
          sideboard: {
            in: sideboardIn,
            out: sideboardOut,
          }
        }
      };

      // Try PUT (update) first, fall back to POST (create)
      const putRes = await mcpFetch(`${API_BASE_URL}/api/decks/${publicId}/matchups/${heroId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
        body: JSON.stringify(matchupPayload)
      });

      let data = await putRes.json();

      if (!putRes.ok || !data.success) {
        // If not found (404), create it
        if (putRes.status === 404) {
          const postRes = await mcpFetch(`${API_BASE_URL}/api/decks/${publicId}/matchups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
            body: JSON.stringify(matchupPayload)
          });
          data = await postRes.json();
          if (!postRes.ok || !data.success) {
            return { success: false, error: data.error || `Failed to create matchup (HTTP ${postRes.status}).` };
          }
        } else {
          return { success: false, error: data.error || `Failed to save matchup (HTTP ${putRes.status}).` };
        }
      }

      const heroLabel = heroId === 'core' ? 'Core (Baseline)' : heroId;
      const swapSummary = sideboardIn.length > 0 || sideboardOut.length > 0
        ? `${sideboardOut.length} out, ${sideboardIn.length} in`
        : 'no sideboard changes';

      return {
        success: true,
        message: `Saved matchup for "${heroLabel}" on deck "${deck.name}" (${swapSummary})${notes ? `\nNotes: ${notes}` : ''}`
          + (lineupResult ? `\n${formatLineupSummary(lineupResult)}` : ''),
        deckName: deck.name,
        publicId,
        heroId,
        sideboard: { in: sideboardIn, out: sideboardOut },
        ...(lineupResult ? { changes: lineupResult.changes, stats: lineupResult.stats } : {}),
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};

const PITCH_WORD: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

/** Human-readable diff + the same before→after stats the matchup editor's stats bar shows. */
function formatLineupSummary(r: LineupResult): string {
  const lib = r.stats.library;
  const gear = r.stats.equipment;
  const lines: string[] = [];
  lines.push(`Library ${lib.before} → ${lib.after} (−${lib.out} / +${lib.in}) · Gear ${gear.before} → ${gear.after} (−${gear.out} / +${gear.in})`);
  if (r.changes.length === 0) {
    lines.push('No changes vs the base deck.');
  } else {
    for (const c of r.changes) {
      const label = c.pitch && PITCH_WORD[c.pitch] ? `${c.name} (${PITCH_WORD[c.pitch]})` : c.name;
      const delta = c.to - c.from;
      lines.push(`  ${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${label}: ${c.from} → ${c.to}`);
    }
  }
  return lines.join('\n');
}
