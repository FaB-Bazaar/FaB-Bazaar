/**
 * renderGameText — turns a raw archived Talishar blob into readable, name-
 * resolved, exact-order turn-by-turn text. Used by the get_results MCP tool so
 * the model reads prose (card names + what happened each turn) instead of raw
 * [turn, slug, action] tuples in a structured view it can't reason over.
 *
 * Card names are resolved from the blob itself — every card that did anything
 * appears in cardResults / arenaCardResults / tokenResults / character with its
 * cardName — so no external lookups are needed. Slugs are normalized to match.
 */

import { analyzeGame, type RawGamePayload, type RawCard, type RawDeckBlob } from './analyzeGame';
import { normalizeTalisharId } from './cardId';

const ACTION_LABEL: Record<string, string> = {
  M: 'played',
  P: 'pitched',
  B: 'blocked',
  D: 'defended',
  INSTANT: 'instant',
  HIT: 'HIT',
  A: 'arsenal',
  PASSIVE: 'passive',
  DISCARD: 'discarded',
};
const label = (a: string) => ACTION_LABEL[a] ?? a.toLowerCase();

function prettySlug(id: string): string {
  return id
    .replace(/^[A-Z]{3}\d{3}_/, '')
    .replace(/_(red|yellow|blue)$/, '')
    .replace(/_(equip|ally)$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function collectNames(blob: RawDeckBlob | null | undefined, map: Map<string, string>): void {
  if (!blob) return;
  const lists: unknown[] = [blob.cardResults, blob.arenaCardResults, (blob as any).tokenResults, (blob as any).character];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const c of list as RawCard[]) {
      if (typeof c?.cardId === 'string' && c.cardName) {
        const key = normalizeTalisharId(c.cardId);
        if (!map.has(key)) map.set(key, c.cardName);
      }
    }
  }
}

export function renderGameText(payload: RawGamePayload): string {
  const a = analyzeGame(payload);

  const nameMap = new Map<string, string>();
  collectNames(payload.self, nameMap);
  collectNames(payload.opponent, nameMap);
  const nm = (slug: string) => nameMap.get(normalizeTalisharId(slug)) ?? prettySlug(slug);

  const youHero = prettySlug(a.you.hero || 'You');
  const oppHero = a.opponent ? prettySlug(a.opponent.hero || 'Opponent') : 'Opponent';
  const seat = a.you.firstPlayer ? 'first' : 'second';

  const lines: string[] = [];
  lines.push(
    `${youHero} vs ${oppHero} — ${a.you.result.toUpperCase()} in ${a.you.turns} turns (you went ${seat}${a.meta.conceded ? ', conceded' : ''}).`
  );
  lines.push('');
  lines.push(
    `YOU: dealt ${a.you.efficiency.dealt}/${a.you.efficiency.threatened} threatened (${a.you.efficiency.pct}% landed) · blocked ${a.you.totals.damageBlocked} · avg value/turn ${a.you.totals.avgValuePerTurn}`
  );
  if (a.opponent) {
    lines.push(
      `OPP: dealt ${a.opponent.efficiency.dealt}/${a.opponent.efficiency.threatened} threatened (${a.opponent.efficiency.pct}% landed) · blocked ${a.opponent.totals.damageBlocked}`
    );
  }
  lines.push('');
  lines.push('Turn-by-turn — exact order per player. Draws and triggered sub-effects are NOT logged by Talishar.');

  for (const t of a.replay) {
    const you = t.you.map((e) => `${label(e.action)} ${nm(e.cardId)}`).join(', ') || '—';
    lines.push(`T${t.turn} YOU: ${you}`);
    if (a.opponent) {
      const opp = t.opp.map((e) => `${label(e.action)} ${nm(e.cardId)}`).join(', ') || '—';
      lines.push(`T${t.turn} OPP: ${opp}`);
    }
  }

  return lines.join('\n');
}
