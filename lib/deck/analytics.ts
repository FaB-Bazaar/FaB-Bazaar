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

/**
 * Card-intrinsic attributes carried through the consensus so the AI context can
 * self-describe every core+flex card (type/cost/power/defense/rules text). They
 * are identical across every deck that runs the card, so the first occurrence
 * populates them (same first-seen rule as `printingId`).
 */
export interface ConsensusCardAttrs {
  typeText?: string;
  cost?: number;
  power?: number;
  defense?: number;
  text?: string;
}

export interface ConsensusCard extends ConsensusCardAttrs {
  name: string;
  pitch?: number;
  /** How many decks in the set run this card. */
  decks: number;
  /** Most common copy-count across the decks that run it. */
  typicalQty: number;
  /** A representative printing, so the card can preview in the rail. */
  printingId?: string;
  /** The representative printing's stored image_url (printing_id CDN links 404 — images deleted 2026-07). */
  imageUrl?: string;
}

export interface ConsensusDeck {
  name: string;
  cards: Array<{ name: string; pitch?: number; quantity?: number; cardUniqueId?: string; printingId?: string; imageUrl?: string } & ConsensusCardAttrs>;
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

// ── Deck-view grouping (for the card-grid overlay) ─────────────────────────

export interface DeckViewCard {
  printingId?: string;
  name: string;
  quantity: number;
  pitch?: number;
  imageUrl?: string;
}

export interface DeckViewSection {
  key: 'red' | 'yellow' | 'blue' | 'colorless';
  title: string;
  cards: DeckViewCard[];
}

const PITCH_SECTIONS: Array<{ key: DeckViewSection['key']; title: string; pitch?: number }> = [
  { key: 'red', title: 'Red', pitch: 1 },
  { key: 'yellow', title: 'Yellow', pitch: 2 },
  { key: 'blue', title: 'Blue', pitch: 3 },
  { key: 'colorless', title: 'Equipment & Colorless' },
];

/** Group cards into Red/Yellow/Blue/Colorless sections (in that order) for the deck-view overlay. */
export function groupDeckViewByPitch(cards: DeckViewCard[]): DeckViewSection[] {
  return PITCH_SECTIONS.map(({ key, title, pitch }) => ({
    key,
    title,
    cards: (cards ?? [])
      .filter((c) => (pitch === undefined ? !c.pitch || c.pitch < 1 || c.pitch > 3 : c.pitch === pitch))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((s) => s.cards.length > 0);
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

  // key → { name, pitch, representative printingId, card attrs, quantities: one per deck }
  type AggEntry = { name: string; pitch?: number; printingId?: string; imageUrl?: string; quantities: number[] } & ConsensusCardAttrs;
  const agg = new Map<string, AggEntry>();
  const curve = { red: 0, yellow: 0, blue: 0 };

  // First-seen wins for each card-intrinsic attribute (identical across decks).
  const fillAttrs = (e: AggEntry, src: ConsensusCardAttrs) => {
    if (e.typeText === undefined) e.typeText = src.typeText;
    if (e.cost === undefined) e.cost = src.cost;
    if (e.power === undefined) e.power = src.power;
    if (e.defense === undefined) e.defense = src.defense;
    if (e.text === undefined) e.text = src.text;
  };

  for (const deck of decks) {
    // Collapse duplicate rows within a deck (same card listed twice) into one qty.
    const perDeck = new Map<string, { name: string; pitch?: number; printingId?: string; imageUrl?: string; qty: number } & ConsensusCardAttrs>();
    for (const c of deck.cards ?? []) {
      const key = c.cardUniqueId || `${c.name.toLowerCase()}|${c.pitch ?? 0}`;
      const qty = c.quantity ?? 1;
      const cur = perDeck.get(key);
      if (cur) cur.qty += qty;
      else perDeck.set(key, {
        name: c.name, pitch: c.pitch, printingId: c.printingId, imageUrl: c.imageUrl, qty,
        typeText: c.typeText, cost: c.cost, power: c.power, defense: c.defense, text: c.text,
      });
    }
    for (const [key, entry] of perDeck) {
      const { name, pitch, printingId, imageUrl, qty } = entry;
      const e = agg.get(key) ?? { name, pitch, printingId, imageUrl, quantities: [] };
      if (!e.printingId && printingId) e.printingId = printingId;
      if (!e.imageUrl && imageUrl) e.imageUrl = imageUrl;
      fillAttrs(e, entry);
      e.quantities.push(qty);
      agg.set(key, e);
      if (pitch === 1) curve.red += qty;
      else if (pitch === 2) curve.yellow += qty;
      else if (pitch === 3) curve.blue += qty;
    }
  }

  const core: ConsensusCard[] = [];
  const flex: ConsensusCard[] = [];
  for (const { name, pitch, printingId, imageUrl, quantities, typeText, cost, power, defense, text } of agg.values()) {
    const card: ConsensusCard = {
      name, pitch, printingId, imageUrl, decks: quantities.length, typicalQty: mode(quantities),
      typeText, cost, power, defense, text,
    };
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
