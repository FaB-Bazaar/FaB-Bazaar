import type { RawGamePayload } from '@/lib/talishar/analyzeGame';
import { buildComboTurn, comboTurnCardIds, type ComboCardInfo, type ComboTurnSnapshot } from './combo-turn';

/**
 * Freeze game turns into article `combo-turn` sections. A section sent with
 * `deckName` + `resultId` + `turn` gets `snapshot` (the turn as the log has it
 * now) and loses those three fields. One already holding a `snapshot` passes
 * through untouched, so captions can be edited without re-reading the game.
 * The game is fetched with the author's bearer, so only their games resolve.
 */

export interface ComboTurnIO {
  resolveDeck(name: string): Promise<{ ok: true; publicId: string; name: string } | { ok: false; error: string }>;
  fetchGame(deckPublicId: string, resultId: string): Promise<RawGamePayload | null>;
  fetchCards(ids: string[]): Promise<Record<string, ComboCardInfo>>;
}

export type FrozenComboTurn = ComboTurnSnapshot & { takenAt: string; deckName: string };

export async function withComboTurnSnapshots(
  sections: Record<string, any>[],
  io: ComboTurnIO,
  now: Date = new Date(),
): Promise<Record<string, any>[]> {
  return Promise.all(sections.map(async (section) => {
    if (section?.type !== 'combo-turn' || section.snapshot) return section;
    const { deckName, resultId, turn, ...rest } = section;
    if (!deckName || !resultId || typeof turn !== 'number') {
      throw new Error('combo-turn needs deckName, resultId (from list_results) and turn (a number)');
    }
    const deck = await io.resolveDeck(deckName);
    if (!deck.ok) throw new Error(deck.error);
    const game = await io.fetchGame(deck.publicId, resultId);
    if (!game) throw new Error(`Game ${resultId} has no turn-by-turn archive to build a combo turn from`);

    const cards = await io.fetchCards(comboTurnCardIds(game, turn));
    const built = buildComboTurn(game, turn, cards);
    const captions = rest.captions;
    if (captions !== undefined) {
      if (!Array.isArray(captions) || captions.some((c) => typeof c !== 'string')) {
        throw new Error('captions must be an array of strings, one per step');
      }
      if (captions.length > built.steps.length) {
        throw new Error(`Turn ${turn} has ${built.steps.length} steps; got ${captions.length} captions`);
      }
    }
    const snapshot: FrozenComboTurn = { ...built, takenAt: now.toISOString().slice(0, 10), deckName: deck.name };
    return { ...rest, snapshot };
  }));
}

const OUTCOME_TEXT = { hit: 'hit', 'no-hit': 'no hit', lethal: 'game ends' } as const;

/** Numbered step list, so the author can line captions up with steps. */
export function describeComboTurn(section: Record<string, any>): string {
  const s = section.snapshot as FrozenComboTurn | undefined;
  if (!s) return 'combo-turn section';
  const captions: string[] = section.captions ?? [];
  const head = `combo-turn: turn ${s.turn} vs ${s.opponent.name} (${s.result}${s.lethal ? ', lethal' : ''}) — `
    + `opponent life ${s.opponentLife.start ?? '?'} → ${s.opponentLife.end ?? '?'}, ${s.damage.dealt ?? '?'} dealt / ${s.damage.threatened ?? '?'} threatened. `
    + `${s.steps.length} steps (captions[i] goes with step i+1):`;
  const lines = s.steps.map((st, i) => {
    const bits: string[] = [st.kind];
    if (st.outcome) bits.push(OUTCOME_TEXT[st.outcome]);
    if (st.pitched.length) bits.push(`pitched ${st.pitched.map((p) => p.name).join(', ')}`);
    const cap = captions[i] ? ` — caption: "${captions[i]}"` : '';
    return `  ${i + 1}. ${st.name} (${bits.join(', ')})${cap}`;
  });
  return [head, ...lines].join('\n');
}

/** App-API backed IO for the MCP tools (author's bearer on every call). */
export function comboTurnIO(
  apiBase: string,
  bearer: string,
  resolveOwnedDeck: (apiBase: string, token: string, name: string) => ReturnType<ComboTurnIO['resolveDeck']>,
): ComboTurnIO {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` };
  return {
    resolveDeck: (name) => resolveOwnedDeck(apiBase, bearer, name),
    async fetchGame(deckPublicId, resultId) {
      const res = await fetch(
        `${apiBase}/api/decks/${encodeURIComponent(deckPublicId)}/results/${encodeURIComponent(resultId)}/raw?shape=raw`,
        { headers },
      );
      if (!res.ok) return null;
      const body = await res.json();
      return body?.success ? body.data : null;
    },
    async fetchCards(ids) {
      const res = await fetch(`${apiBase}/api/cards/by-talishar-id`, {
        method: 'POST', headers, body: JSON.stringify({ ids, details: true }),
      });
      if (!res.ok) return {};
      const body = await res.json();
      const out: Record<string, ComboCardInfo> = {};
      for (const [id, c] of Object.entries<any>(body?.data ?? {})) {
        out[id] = { name: c.displayName, imageUrl: c.imageUrl ?? null, pitch: c.pitch ?? null, types: c.types ?? [] };
      }
      return out;
    },
  };
}
