import type { RawGamePayload } from '@/lib/talishar/analyzeGame';
import { resolveStartingHero } from '@/lib/talishar/startingHero';
import { canonicalHeroId } from '@/lib/talishar/canonicalHero';

/**
 * Freeze one turn of an archived Talishar game into an article `combo-turn`
 * section. Pure: the caller supplies the raw payload and the card info for
 * every id `comboTurnCardIds` lists (the MCP tools fetch both through the app
 * API with the author's bearer, so only the author's own games resolve).
 *
 * What the log gives (turnLog = [turn, cardId, code]):
 *   M       played / activated / attacked with
 *   HIT     the last attack with that card hit
 *   P       pitched — paid for the card just played
 *   INSTANT played at instant speed
 *   B, DISCARD, …  blocks on the opponent's turn and discards — not shown
 * Per-attack damage is NOT logged, only turn totals (turnResults).
 */

export interface ComboCardInfo {
  name: string;
  imageUrl: string | null;
  pitch: number | null;
  types: string[];
}

export type ComboStepKind = 'attack' | 'action' | 'activate' | 'hero' | 'instant' | 'play';
export type ComboOutcome = 'hit' | 'no-hit' | 'lethal';

export interface ComboPitch { cardId: string; name: string; pitch: number | null; imageUrl: string | null }

export interface ComboStep {
  cardId: string;
  name: string;
  imageUrl: string | null;
  kind: ComboStepKind;
  /** Attacks only. 'lethal' = the game-ending swing (no HIT gets logged for it). */
  outcome?: ComboOutcome;
  pitched: ComboPitch[];
}

export interface ComboTurnSnapshot {
  turn: number;
  result: 'win' | 'loss';
  /** The game ended on this turn in your favour. */
  lethal: boolean;
  hero: { cardId: string; name: string; imageUrl: string | null };
  opponent: { cardId: string; name: string; imageUrl: string | null };
  opponentLife: { start: number | null; end: number | null };
  damage: { dealt: number | null; threatened: number | null };
  steps: ComboStep[];
}

type LogRow = [number, string, string];

function turnRows(payload: RawGamePayload, turn: number): LogRow[] {
  const log = (payload.self?.turnLog ?? []) as LogRow[];
  const rows = log.filter((r) => r[0] === turn);
  if (!rows.some((r) => r[2] === 'M' || r[2] === 'INSTANT')) {
    const turns = [...new Set(log.filter((r) => r[2] === 'M').map((r) => r[0]))].sort((a, b) => a - b);
    throw new Error(`Turn ${turn} has no plays by you in this game. Your turns: ${turns.join(', ')}`);
  }
  return rows;
}

function turnStats(payload: RawGamePayload, turn: number): Record<string, any> | undefined {
  const tr = (payload.self?.turnResults ?? {}) as Record<string, any>;
  return tr[`turn_${turn}`] ?? tr[String(turn)];
}

/**
 * The hero a side STARTED as. `playerHero` is an end-of-game snapshot (Viserai
 * shows up as Viserai, Usurper), so prefer character[0] — see canonicalHero.ts.
 */
function startingHero(payload: RawGamePayload, side: 'self' | 'opponent'): string {
  return canonicalHeroId(resolveStartingHero(payload[side] as any), payload.format) || '';
}

/** Every card id the snapshot needs looked up (turn's cards + both heroes). */
export function comboTurnCardIds(payload: RawGamePayload, turn: number): string[] {
  const ids = new Set<string>();
  for (const [, id, code] of turnRows(payload, turn)) {
    if (code === 'M' || code === 'INSTANT' || code === 'P') ids.add(id);
  }
  for (const side of ['self', 'opponent'] as const) {
    const hero = startingHero(payload, side);
    if (hero) ids.add(hero);
  }
  return [...ids];
}

const fallbackName = (id: string) => id.replace(/_/g, ' ');

function kindOf(info: ComboCardInfo | undefined, code: string): ComboStepKind {
  if (code === 'INSTANT') return 'instant';
  const types = info?.types ?? [];
  if (types.includes('hero')) return 'hero';
  if (types.includes('attack') || types.includes('weapon')) return 'attack';
  if (types.includes('equipment')) return 'activate';
  if (types.length > 0) return 'action';
  return 'play';
}

export function buildComboTurn(
  payload: RawGamePayload,
  turn: number,
  cards: Record<string, ComboCardInfo>,
): ComboTurnSnapshot {
  const rows = turnRows(payload, turn);
  const ref = (id: string) => ({ cardId: id, name: cards[id]?.name ?? fallbackName(id), imageUrl: cards[id]?.imageUrl ?? null });

  const steps: ComboStep[] = [];
  let pendingPitch: ComboPitch[] = [];
  for (const [, id, code] of rows) {
    if (code === 'M' || code === 'INSTANT') {
      const kind = kindOf(cards[id], code);
      const step: ComboStep = { ...ref(id), kind, pitched: pendingPitch };
      if (kind === 'attack') step.outcome = 'no-hit';
      pendingPitch = [];
      steps.push(step);
    } else if (code === 'P') {
      const p = { ...ref(id), pitch: cards[id]?.pitch ?? null };
      const last = steps[steps.length - 1];
      // A pitch pays for the card just played; one before any play pays for the next.
      if (last) last.pitched.push(p);
      else pendingPitch.push(p);
    } else if (code === 'HIT') {
      const target = [...steps].reverse().find((s) => s.cardId === id && s.outcome === 'no-hit');
      if (target) target.outcome = 'hit';
    }
  }

  const self = payload.self ?? ({} as any);
  const won = self.result === 1;
  const lastTurn = Math.max(...((self.turnLog ?? []) as LogRow[]).map((r) => r[0]));
  const lethal = won && turn === lastTurn && !payload.conceded;
  if (lethal) {
    const lastAttack = [...steps].reverse().find((s) => s.kind === 'attack');
    if (lastAttack && lastAttack.outcome === 'no-hit') lastAttack.outcome = 'lethal';
  }

  const stats = turnStats(payload, turn);
  const before = turnStats(payload, turn - 1);
  const num = (v: unknown) => (typeof v === 'number' ? v : null);

  return {
    turn,
    result: won ? 'win' : 'loss',
    lethal,
    hero: ref(startingHero(payload, 'self')),
    opponent: ref(startingHero(payload, 'opponent')),
    opponentLife: {
      start: num(before?.opponentLifeAtTurnEnd),
      end: lethal ? 0 : num(stats?.opponentLifeAtTurnEnd),
    },
    damage: { dealt: num(stats?.damageDealt), threatened: num(stats?.damageThreatened) },
    steps,
  };
}

/** Attributes for an article `combo-turn` section → <fab-combo-turn>. */
export function comboTurnBlockAttrs(section: { type?: string; snapshot?: unknown; captions?: unknown; heading?: string }): Record<string, string | undefined> {
  return {
    snapshot: section.snapshot ? JSON.stringify(section.snapshot) : undefined,
    captions: Array.isArray(section.captions) ? JSON.stringify(section.captions) : undefined,
    heading: section.heading || undefined,
  };
}
