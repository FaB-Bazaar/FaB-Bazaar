// components/deck/editor/mobile-lanes.test.ts
//
// Lane building for the mobile swipe pager. Lanes are pages you swipe between,
// grouped either by card type (the header carries the type, so rows need no type
// cue of their own) or by pitch.

import { describe, it, expect } from 'vitest';
import { buildLanes, primaryTypeLane, type LaneCardLike } from './mobile-lanes';

const card = (over: Partial<LaneCardLike> & { displayName: string }): LaneCardLike => ({
  totalQty: 3,
  pitch: 1,
  category: 'maindeck',
  types: ['generic', 'action', 'attack'],
  ...over,
});

describe('primaryTypeLane', () => {
  // Mirrors primaryCategoryLabel() in app/api/mcp/resource/deckViewer.ts, including
  // its tokenisation: some rows store "attack action" as one string, others as two.
  it('reads the reaction types before the bare attack/action words', () => {
    expect(primaryTypeLane(['ninja', 'attack reaction'])).toBe('Attack Reactions');
    expect(primaryTypeLane(['guardian', 'action', 'defense reaction'])).toBe('Defense Reactions');
  });

  it('splits attack actions out of plain actions', () => {
    expect(primaryTypeLane(['warrior', 'action', 'attack'])).toBe('Attack Actions');
    expect(primaryTypeLane(['mechanologist', 'action', 'item'])).toBe('Actions');
  });

  it('handles a multi-word type stored as a single token', () => {
    expect(primaryTypeLane(['attack action'])).toBe('Attack Actions');
    expect(primaryTypeLane(['defense reaction'])).toBe('Defense Reactions');
  });

  it('reads instants ahead of any attack/action words on the same card', () => {
    expect(primaryTypeLane(['assassin', 'instant', 'item'])).toBe('Instants');
  });

  it('falls through to Other for blocks and anything unrecognised', () => {
    expect(primaryTypeLane(['bard', 'block'])).toBe('Other');
    expect(primaryTypeLane([])).toBe('Other');
  });
});

describe('buildLanes — type mode', () => {
  const deck: LaneCardLike[] = [
    card({ displayName: 'Command and Conquer', pitch: 1 }),
    card({ displayName: 'Scrap Hopper', pitch: 3 }),
    card({ displayName: 'Hyper Driver', pitch: 1, types: ['mechanologist', 'action', 'item'] }),
    card({ displayName: 'Sink Below', pitch: 1, types: ['generic', 'defense reaction'] }),
    card({ displayName: 'Sigil of Solace', pitch: 1, types: ['generic', 'instant'] }),
  ];

  it('orders lanes the way the reference viewer does', () => {
    const lanes = buildLanes(deck, 'type');
    expect(lanes.map(l => l.label)).toEqual(['Attack Actions', 'Defense Reactions', 'Instants', 'Actions']);
  });

  it('counts copies, not rows', () => {
    const lanes = buildLanes([
      card({ displayName: 'Command and Conquer', totalQty: 3 }),
      card({ displayName: 'Step Between', totalQty: 1 }),
    ], 'type');
    expect(lanes[0].count).toBe(4);
  });

  it('sorts a lane by pitch then name, so same-name reprints stack together', () => {
    const lanes = buildLanes([
      card({ displayName: 'Scrap Hopper', pitch: 3 }),
      card({ displayName: 'Command and Conquer', pitch: 1 }),
      card({ displayName: 'Fearless Confrontation', pitch: 3 }),
      card({ displayName: 'Enlightened Strike', pitch: 1 }),
    ], 'type');
    expect(lanes[0].cards.map(c => c.displayName)).toEqual([
      'Command and Conquer', 'Enlightened Strike', 'Fearless Confrontation', 'Scrap Hopper',
    ]);
  });

  it('drops empty lanes so the pager has no blank pages', () => {
    const lanes = buildLanes([card({ displayName: 'Command and Conquer' })], 'type');
    expect(lanes).toHaveLength(1);
  });
});

describe('buildLanes — pitch mode', () => {
  const deck: LaneCardLike[] = [
    card({ displayName: 'Scrap Hopper', pitch: 3 }),
    card({ displayName: 'Fate Foreseen', pitch: 2 }),
    card({ displayName: 'Command and Conquer', pitch: 1 }),
    card({ displayName: 'Codex of Frailty', pitch: null }),
  ];

  it('lanes red → yellow → blue → unpitched', () => {
    expect(buildLanes(deck, 'pitch').map(l => l.label)).toEqual(['Red', 'Yellow', 'Blue', 'Unpitched']);
  });

  it('sorts a pitch lane by name', () => {
    const lanes = buildLanes([
      card({ displayName: 'Zero to Sixty', pitch: 1 }),
      card({ displayName: 'Adrenaline Rush', pitch: 1 }),
    ], 'pitch');
    expect(lanes[0].cards.map(c => c.displayName)).toEqual(['Adrenaline Rush', 'Zero to Sixty']);
  });
});

describe('buildLanes — deck zones', () => {
  // Zones are lanes in both modes: only the maindeck gets split by type/pitch.
  const zoned: LaneCardLike[] = [
    card({ displayName: 'mBrio, Sonic Vizier', category: 'hero', types: ['mechanologist', 'hero'], totalQty: 1 }),
    card({ displayName: 'Teklo Foundry Heart', category: 'equipment', types: ['mechanologist', 'equipment', 'chest'], totalQty: 1 }),
    card({ displayName: 'Command and Conquer', category: 'maindeck' }),
    card({ displayName: 'Adaptive Dissolver', category: 'inventory', totalQty: 1 }),
    card({ displayName: 'Zero to Sixty', category: 'benched', totalQty: 2 }),
  ];

  it('puts hero and equipment in one gear lane, then inventory and bench last', () => {
    for (const mode of ['type', 'pitch'] as const) {
      const labels = buildLanes(zoned, mode).map(l => l.label);
      expect(labels.slice(-3)).toEqual(['Hero & Equipment', 'Inventory', 'Bench']);
    }
  });

  it('leads the gear lane with the hero', () => {
    const gear = buildLanes(zoned, 'type').find(l => l.key === 'gear')!;
    expect(gear.cards[0].displayName).toBe('mBrio, Sonic Vizier');
  });

  it('never routes a zone card into a type or pitch lane', () => {
    const laneOf = (name: string) => buildLanes(zoned, 'type').find(l => l.cards.some(c => c.displayName === name))!.key;
    expect(laneOf('Adaptive Dissolver')).toBe('inventory');
    expect(laneOf('Zero to Sixty')).toBe('bench');
    expect(laneOf('Teklo Foundry Heart')).toBe('gear');
  });

  it('returns no lanes for an empty deck', () => {
    expect(buildLanes([], 'type')).toEqual([]);
  });
});
