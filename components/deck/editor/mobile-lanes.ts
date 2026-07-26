// components/deck/editor/mobile-lanes.ts
//
// Lane building for the mobile deck list — the pages of the swipe pager.
//
// Grouping by type is what lets the row stay bare: the lane header says
// "Attack Actions", so no per-row type cue is needed. Pitch mode keeps the
// pitch rail load-bearing instead (same card name appears at several pitches).

export type LaneMode = 'type' | 'pitch';

export interface LaneCardLike {
  displayName: string;
  totalQty: number;
  pitch: number | null;
  /** Deck zone: 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'benched' */
  category: string;
  types: string[];
}

export interface Lane<T extends LaneCardLike = LaneCardLike> {
  key: string;
  label: string;
  /** Copies, not rows. */
  count: number;
  cards: T[];
}

// Mirrors primaryCategoryLabel() in app/api/mcp/resource/deckViewer.ts — the
// function behind the desktop lane viewer. Keep the two in step; they are
// deliberately the same taxonomy, and that file embeds its copy as a string
// template (generated HTML), so it can't be imported.
const TYPE_LANE_ORDER = [
  'Attack Actions', 'Attack Reactions', 'Defense Reactions',
  'Non-Attack Actions', 'Instants', 'Actions', 'Items',
  'Allies', 'Resources', 'Other',
] as const;

export function primaryTypeLane(types: string[] | null | undefined): string {
  // Token-or-phrase resilient: some rows store "attack action" as one string,
  // others as ["attack", "action"].
  const set = new Set<string>();
  for (const raw of types || []) {
    const s = String(raw).toLowerCase().trim();
    if (!s) continue;
    set.add(s);
    for (const w of s.split(/\s+/)) if (w) set.add(w);
  }
  const has = (...words: string[]) => words.every(w => set.has(w));

  if (has('attack', 'reaction')) return 'Attack Reactions';
  if (has('defense', 'reaction')) return 'Defense Reactions';
  if (has('instant')) return 'Instants';
  if (has('attack', 'action')) return 'Attack Actions';
  if (has('non-attack', 'action')) return 'Non-Attack Actions';
  if (has('action')) return 'Actions';
  if (has('item')) return 'Items';
  if (has('ally')) return 'Allies';
  if (has('resource')) return 'Resources';
  return 'Other';
}

const PITCH_LANES: Array<{ key: string; label: string; pitch: number | null }> = [
  { key: 'red', label: 'Red', pitch: 1 },
  { key: 'yellow', label: 'Yellow', pitch: 2 },
  { key: 'blue', label: 'Blue', pitch: 3 },
  { key: 'unpitched', label: 'Unpitched', pitch: null },
];

/** Zones are lanes in both modes — only the maindeck splits by type or pitch. */
const ZONE_LANES: Array<{ key: string; label: string; categories: string[] }> = [
  { key: 'gear', label: 'Hero & Equipment', categories: ['hero', 'equipment'] },
  { key: 'inventory', label: 'Inventory', categories: ['inventory'] },
  { key: 'bench', label: 'Bench', categories: ['benched'] },
];

const laneKey = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

export function buildLanes<T extends LaneCardLike>(cards: T[], mode: LaneMode): Array<Lane<T>> {
  const zoned = new Set(ZONE_LANES.flatMap(z => z.categories));
  const maindeck = cards.filter(c => !zoned.has(c.category));

  const byName = (a: T, b: T) => a.displayName.localeCompare(b.displayName);
  const byPitchThenName = (a: T, b: T) => (a.pitch ?? 99) - (b.pitch ?? 99) || byName(a, b);

  const lanes: Array<Lane<T>> = [];

  if (mode === 'type') {
    for (const label of TYPE_LANE_ORDER) {
      const laneCards = maindeck.filter(c => primaryTypeLane(c.types) === label).sort(byPitchThenName);
      if (laneCards.length) lanes.push({ key: laneKey(label), label, count: 0, cards: laneCards });
    }
  } else {
    for (const { key, label, pitch } of PITCH_LANES) {
      const laneCards = maindeck.filter(c => (c.pitch ?? null) === pitch).sort(byName);
      if (laneCards.length) lanes.push({ key, label, count: 0, cards: laneCards });
    }
  }

  for (const zone of ZONE_LANES) {
    // Hero leads the gear lane; everything else is alphabetical.
    const laneCards = cards
      .filter(c => zone.categories.includes(c.category))
      .sort((a, b) => {
        const heroRank = (c: T) => (c.category === 'hero' ? 0 : 1);
        return heroRank(a) - heroRank(b) || byName(a, b);
      });
    if (laneCards.length) lanes.push({ key: zone.key, label: zone.label, count: 0, cards: laneCards });
  }

  for (const lane of lanes) lane.count = lane.cards.reduce((s, c) => s + c.totalQty, 0);
  return lanes;
}
