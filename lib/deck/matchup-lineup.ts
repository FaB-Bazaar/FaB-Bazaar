/**
 * Matchup lineup engine — declarative "this is the active list vs hero X"
 * → the `sideboard.in[] / sideboard.out[]` swaps the matchup routes store.
 *
 * This is the same model the matchup tile editor uses
 * (components/deck/MatchupSideboardEditor.tsx):
 *
 *   pool      = hero + equipment + maindeck  (the base deck)
 *             + inventory                    (the sideboard bench)
 *   grouped by Talishar id  = toTalisharIdentifier(name) + _red/_yellow/_blue
 *                             (printing-agnostic; foils/alt-arts collapse)
 *   available = copies of that card anywhere in the pool
 *   baseCount = copies in the base deck
 *   active    = what the lineup asks for (unlisted ⇒ 0, i.e. greyed out)
 *   out       = max(0, base − active) ids, in = max(0, active − base) ids
 *
 * The hero is never sided (hero tiles are non-interactive in the editor).
 * `benched` and `tokens` are NOT part of the pool — benched is a maybe-pile
 * outside the playable deck.
 *
 * Pure: no I/O, no service imports. Safe to use from MCP tools and routes.
 */
import { toTalisharIdentifier } from '@/lib/utils';

export type PoolSection = 'hero' | 'equipment' | 'library';

export interface PoolCard {
  talisharId: string;
  name: string;
  pitch: number | null;
  section: PoolSection;
  /** copies anywhere in the pool (base deck + inventory) */
  available: number;
  /** copies in the base deck (hero + equipment + maindeck) */
  baseCount: number;
}

export type MatchupPool = Map<string, PoolCard>;

interface PrintingLike {
  printingId?: string;
  quantity?: number;
  printingDetails?: {
    name?: string;
    display_name?: string;
    pitch?: number | { $numberInt: string } | null;
    types?: string[];
    [key: string]: any;
  };
}

export interface DeckLike {
  hero?: PrintingLike[];
  equipment?: PrintingLike[];
  maindeck?: PrintingLike[];
  inventory?: PrintingLike[];
}

export interface LineupEntry {
  /** Card name — resolved with `pitch` to a Talishar id */
  cardName?: string;
  /** Raw Talishar id (e.g. "sink_below_blue"); wins over cardName if both given */
  cardId?: string;
  /** 0/undefined = unpitched, 1 red, 2 yellow, 3 blue */
  pitch?: number | null;
  /** active copies; default 1 */
  quantity?: number;
}

export interface SwapDelta {
  before: number;
  after: number;
  out: number;
  in: number;
}

export interface LineupChange {
  talisharId: string;
  name: string;
  pitch: number | null;
  from: number;
  to: number;
}

export interface LineupResult {
  ok: boolean;
  errors: string[];
  in: string[];
  out: string[];
  changes: LineupChange[];
  stats: { library: SwapDelta; equipment: SwapDelta };
}

const PITCH_SUFFIX: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

function readPitch(p: PrintingLike): number | null {
  const pv = p.printingDetails?.pitch;
  if (typeof pv === 'number') return pv;
  if (pv && typeof pv === 'object' && '$numberInt' in pv) return parseInt(pv.$numberInt, 10);
  return null;
}

/** Talishar id for a card name + pitch: `sink_below_blue`, `adaptive_alpha_mold`. */
export function lineupCardId(cardName: string, pitch?: number | null): string {
  const base = toTalisharIdentifier(cardName);
  const suffix = pitch ? PITCH_SUFFIX[pitch] : undefined;
  return suffix ? `${base}_${suffix}` : base;
}

function printingTalisharId(p: PrintingLike): string {
  const name = p.printingDetails?.name || '';
  const base = toTalisharIdentifier(name) || p.printingId || '';
  const pitch = readPitch(p);
  const suffix = pitch ? PITCH_SUFFIX[pitch] : undefined;
  return suffix ? `${base}_${suffix}` : base;
}

/** Same section rule as the editor: weapons + non-Evo equipment → equipment; Evo → library. */
function sectionOf(p: PrintingLike, zone: 'hero' | 'equipment' | 'maindeck' | 'inventory'): PoolSection {
  if (zone === 'hero') return 'hero';
  const types = (p.printingDetails?.types || []).map((t) => String(t).toLowerCase());
  const isEvo = types.includes('evo');
  if (types.includes('weapon') || (!isEvo && (types.includes('equipment') || zone === 'equipment'))) {
    return 'equipment';
  }
  return 'library';
}

/** Build the matchup pool from a deck DTO (hero/equipment/maindeck = base, inventory = bench). */
export function buildMatchupPool(deck: DeckLike): MatchupPool {
  const pool: MatchupPool = new Map();
  const absorb = (printings: PrintingLike[] | undefined, zone: 'hero' | 'equipment' | 'maindeck' | 'inventory') => {
    const isBase = zone !== 'inventory';
    for (const p of printings || []) {
      const id = printingTalisharId(p);
      if (!id) continue;
      const qty = p.quantity || 1;
      const existing = pool.get(id);
      if (existing) {
        existing.available += qty;
        if (isBase) existing.baseCount += qty;
      } else {
        pool.set(id, {
          talisharId: id,
          name: p.printingDetails?.display_name || p.printingDetails?.name || id,
          pitch: readPitch(p),
          section: sectionOf(p, zone),
          available: qty,
          baseCount: isBase ? qty : 0,
        });
      }
    }
  };
  absorb(deck.hero, 'hero');
  absorb(deck.equipment, 'equipment');
  absorb(deck.maindeck, 'maindeck');
  absorb(deck.inventory, 'inventory');
  return pool;
}

const PITCH_LABEL: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };
function labelFor(name: string, pitch: number | null | undefined): string {
  return pitch && PITCH_LABEL[pitch] ? `${name} (${PITCH_LABEL[pitch]})` : name;
}

/**
 * Turn a full active lineup into in/out swaps against the pool.
 * Unlisted pool cards are set to 0 (sided out); the hero is never touched.
 */
export function computeLineupSwaps(pool: MatchupPool, lineup: LineupEntry[]): LineupResult {
  const errors: string[] = [];
  const active = new Map<string, number>();

  for (const entry of lineup) {
    const qty = entry.quantity ?? 1;
    const id = entry.cardId
      ? String(entry.cardId).trim().toLowerCase()
      : entry.cardName
        ? lineupCardId(entry.cardName, entry.pitch ?? 0)
        : '';
    if (!id) {
      errors.push('A lineup entry is missing both cardName and cardId.');
      continue;
    }
    active.set(id, (active.get(id) ?? 0) + qty);
  }

  // Validate requested counts against the pool
  for (const [id, qty] of active) {
    const card = pool.get(id);
    const label = (() => {
      const e = lineup.find((x) => (x.cardId ? String(x.cardId).trim().toLowerCase() : x.cardName ? lineupCardId(x.cardName, x.pitch ?? 0) : '') === id);
      return e?.cardName ? labelFor(e.cardName, e.pitch) : id;
    })();
    if (!card) {
      errors.push(
        `"${label}" is not in this deck's pool (main deck, equipment or inventory). ` +
        `Add it to the inventory (sideboard) first with add_cards_to_deck { category: "inventory" }, then set the lineup.`
      );
      continue;
    }
    if (qty > card.available) {
      errors.push(
        `"${labelFor(card.name, card.pitch)}": lineup asks for ${qty} but the pool only holds ${card.available} ` +
        `(${card.baseCount} in the deck + ${card.available - card.baseCount} in inventory).`
      );
    }
  }

  const inList: string[] = [];
  const outList: string[] = [];
  const changes: LineupChange[] = [];
  const blank = (): SwapDelta => ({ before: 0, after: 0, out: 0, in: 0 });
  const stats = { library: blank(), equipment: blank() };

  for (const card of pool.values()) {
    if (card.section === 'hero') continue;
    const to = Math.min(card.available, active.get(card.talisharId) ?? 0);
    const from = card.baseCount;
    const delta = to - from;
    if (delta < 0) for (let i = 0; i < -delta; i++) outList.push(card.talisharId);
    if (delta > 0) for (let i = 0; i < delta; i++) inList.push(card.talisharId);
    if (delta !== 0) changes.push({ talisharId: card.talisharId, name: card.name, pitch: card.pitch, from, to });

    const bucket = card.section === 'equipment' ? stats.equipment : stats.library;
    bucket.before += from;
    bucket.after += to;
    bucket.out += Math.max(0, -delta);
    bucket.in += Math.max(0, delta);
  }

  return { ok: errors.length === 0, errors, in: inList, out: outList, changes, stats };
}
