// Pure helpers for the in-chat "View matchups" panel on deck data cards.
// Mirrors the deck matchups page conventions: strategy ids get their curated
// names (lib/fab-constants/strategyPortraits), hero slugs are title-cased the
// same way MatchupDeltaView humanizes unknown swap ids.
import { getStrategyDisplayName, isStrategyId } from '@/lib/fab-constants/strategyPortraits';
import { toTalisharIdentifier } from '@/lib/utils';

export type SwapPitch = 1 | 2 | 3 | null;

export interface SwapEntry {
  id: string;
  name: string;
  pitch: SwapPitch;
  count: number;
}

function titleCase(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function matchupDisplayName(heroId: string): string {
  if (isStrategyId(heroId)) return getStrategyDisplayName(heroId);
  return titleCase(heroId);
}

const PITCH_SUFFIX: Record<string, 1 | 2 | 3> = { red: 1, yellow: 2, blue: 3 };

export function parseSwapId(id: string): { name: string; pitch: SwapPitch } {
  const m = id.match(/^(.+)_(red|yellow|blue)$/);
  if (m) return { name: titleCase(m[1]), pitch: PITCH_SUFFIX[m[2]] };
  return { name: titleCase(id), pitch: null };
}

export function aggregateSwaps(ids: string[]): SwapEntry[] {
  const groups = new Map<string, SwapEntry>();
  for (const id of ids) {
    const existing = groups.get(id);
    if (existing) {
      existing.count++;
      continue;
    }
    const { name, pitch } = parseSwapId(id);
    groups.set(id, { id, name, pitch, count: 1 });
  }
  return [...groups.values()].sort((a, b) => {
    const pa = a.pitch ?? 99;
    const pb = b.pitch ?? 99;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export function turnOrderLabel(t: 'First' | 'Second' | 'NoPreference' | null): string | null {
  if (t === 'First') return 'Go first';
  if (t === 'Second') return 'Go second';
  if (t === 'NoPreference') return 'No turn-order preference';
  return null;
}

interface SwapRowLike {
  name: string;
  pitch?: number;
  image?: string;
  type?: string;
  text?: string;
  preview?: unknown;
}

export interface SwapCardInfo {
  image?: string;
  type?: string;
  text?: string;
  preview?: unknown;
}

const PITCH_ID_SUFFIX: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

/**
 * Index a deck card's table rows by talishar swap id (`{name}_{pitch color}`,
 * suffix omitted when non-pitched) so matchup side in/out lists can borrow the
 * rows' thumbnail, type line, and hover preview. First row wins per id.
 */
export function buildSwapLookup(
  sections: Array<{ title: string; count: number; rows: SwapRowLike[] }>,
): Map<string, SwapCardInfo> {
  const lookup = new Map<string, SwapCardInfo>();
  for (const section of sections) {
    for (const r of section.rows) {
      const base = toTalisharIdentifier(r.name);
      if (!base) continue;
      const id = r.pitch && PITCH_ID_SUFFIX[r.pitch] ? `${base}_${PITCH_ID_SUFFIX[r.pitch]}` : base;
      if (!lookup.has(id)) lookup.set(id, { image: r.image, type: r.type, text: r.text, preview: r.preview });
    }
  }
  return lookup;
}

interface MatchupLike {
  heroId: string;
  preferredTurnOrder: 'First' | 'Second' | 'NoPreference' | null;
  notes: string | null;
  sideboard: { in: string[]; out: string[] };
}

const PITCH_WORD: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

function swapsToText(ids: string[]): string {
  return aggregateSwaps(ids)
    .map((e) => `${e.count}x ${e.name}${e.pitch ? ` (${PITCH_WORD[e.pitch]})` : ''}`)
    .join(', ');
}

/**
 * Compact AI-context summary of a deck's matchup plans, pushed alongside the
 * visible panel so follow-up questions need no extra tool calls.
 */
export function matchupsToContext(deckName: string, matchups: MatchupLike[]): string {
  const lines = matchups.map((m) => {
    const parts: string[] = [];
    const order = turnOrderLabel(m.preferredTurnOrder);
    if (order) parts.push(order);
    if (m.sideboard.in.length === 0 && m.sideboard.out.length === 0) {
      parts.push('no swaps');
    } else {
      if (m.sideboard.in.length > 0) parts.push(`in: ${swapsToText(m.sideboard.in)}`);
      if (m.sideboard.out.length > 0) parts.push(`out: ${swapsToText(m.sideboard.out)}`);
    }
    if (m.notes) parts.push(`notes: ${m.notes}`);
    return `vs ${matchupDisplayName(m.heroId)} — ${parts.join('; ')}`;
  });
  return [`Configured matchups for deck "${deckName}" (${matchups.length}):`, ...lines].join('\n');
}
