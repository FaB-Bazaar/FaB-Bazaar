// Deterministic deck analytics — pure functions over deck card data, shared by
// the service layer (archetype endpoint) and the client (instant no-AI quick
// actions). No DB, no service imports: safe to import from either layer.

// ── Per-deck color breakdown ───────────────────────────────────────────────

type PitchCard = { quantity?: number; pitch?: number; printingDetails?: { pitch?: number } };

export interface DeckColorBreakdown {
  red: number;
  yellow: number;
  blue: number;
  colorless: number;
}

function pitchOf(c: PitchCard): number {
  return c.printingDetails?.pitch ?? c.pitch ?? 0;
}

/** Count cards by pitch color (1=red, 2=yellow, 3=blue; 0/none=colorless), weighted by quantity. */
export function deckColorBreakdown(cards: PitchCard[]): DeckColorBreakdown {
  const b: DeckColorBreakdown = { red: 0, yellow: 0, blue: 0, colorless: 0 };
  for (const c of cards ?? []) {
    const q = c.quantity ?? 1;
    switch (pitchOf(c)) {
      case 1: b.red += q; break;
      case 2: b.yellow += q; break;
      case 3: b.blue += q; break;
      default: b.colorless += q;
    }
  }
  return b;
}

// ── Cross-deck archetype consensus ─────────────────────────────────────────

export interface ConsensusCard {
  name: string;
  pitch?: number;
  /** How many decks in the set run this card. */
  decks: number;
  /** Most common copy-count across the decks that run it. */
  typicalQty: number;
  /** A representative printing, so the card can preview in the rail. */
  printingId?: string;
}

export interface ConsensusDeck {
  name: string;
  cards: Array<{ name: string; pitch?: number; quantity?: number; cardUniqueId?: string; printingId?: string }>;
}

export interface ArchetypeConsensus {
  deckCount: number;
  /** Cards run in every deck in the set. */
  core: ConsensusCard[];
  /** Cards run in some (not all) decks — the divergence between builds. */
  flex: ConsensusCard[];
  /** Average red/yellow/blue count per deck (rounded). */
  colorCurve: { red: number; yellow: number; blue: number };
}

function mode(nums: number[]): number {
  const counts = new Map<number, number>();
  let best = nums[0] ?? 0;
  let bestCount = 0;
  for (const n of nums) {
    const c = (counts.get(n) ?? 0) + 1;
    counts.set(n, c);
    // Tie-break toward the larger quantity so a 3/3/2 split reads as "3 copies".
    if (c > bestCount || (c === bestCount && n > best)) { best = n; bestCount = c; }
  }
  return best;
}

/**
 * Given a set of decks (e.g. every Decks-to-Beat build of one hero in a time
 * window), compute the consensus list: which cards are core (in every deck),
 * which are flex (the real divergence), each card's adoption count and typical
 * copy-count, and the average color curve. This is the deterministic answer the
 * LLM was faking when asked "compare these decks".
 */
export function computeArchetypeConsensus(decks: ConsensusDeck[]): ArchetypeConsensus {
  const deckCount = decks.length;
  if (deckCount === 0) {
    return { deckCount: 0, core: [], flex: [], colorCurve: { red: 0, yellow: 0, blue: 0 } };
  }

  // key → { name, pitch, representative printingId, quantities: one per deck }
  const agg = new Map<string, { name: string; pitch?: number; printingId?: string; quantities: number[] }>();
  const curve = { red: 0, yellow: 0, blue: 0 };

  for (const deck of decks) {
    // Collapse duplicate rows within a deck (same card listed twice) into one qty.
    const perDeck = new Map<string, { name: string; pitch?: number; printingId?: string; qty: number }>();
    for (const c of deck.cards ?? []) {
      const key = c.cardUniqueId || `${c.name.toLowerCase()}|${c.pitch ?? 0}`;
      const qty = c.quantity ?? 1;
      const cur = perDeck.get(key);
      if (cur) cur.qty += qty;
      else perDeck.set(key, { name: c.name, pitch: c.pitch, printingId: c.printingId, qty });
    }
    for (const [key, { name, pitch, printingId, qty }] of perDeck) {
      const e = agg.get(key) ?? { name, pitch, printingId, quantities: [] };
      if (!e.printingId && printingId) e.printingId = printingId;
      e.quantities.push(qty);
      agg.set(key, e);
      if (pitch === 1) curve.red += qty;
      else if (pitch === 2) curve.yellow += qty;
      else if (pitch === 3) curve.blue += qty;
    }
  }

  const core: ConsensusCard[] = [];
  const flex: ConsensusCard[] = [];
  for (const { name, pitch, printingId, quantities } of agg.values()) {
    const card: ConsensusCard = { name, pitch, printingId, decks: quantities.length, typicalQty: mode(quantities) };
    (quantities.length === deckCount ? core : flex).push(card);
  }

  core.sort((a, b) => (a.pitch ?? 0) - (b.pitch ?? 0) || a.name.localeCompare(b.name));
  flex.sort((a, b) => b.decks - a.decks || a.name.localeCompare(b.name));

  return {
    deckCount,
    core,
    flex,
    colorCurve: {
      red: Math.round(curve.red / deckCount),
      yellow: Math.round(curve.yellow / deckCount),
      blue: Math.round(curve.blue / deckCount),
    },
  };
}
