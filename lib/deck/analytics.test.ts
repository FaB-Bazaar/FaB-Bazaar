import { describe, it, expect } from 'vitest';
import {
  deckColorBreakdown,
  computeArchetypeConsensus,
  groupDeckViewByPitch,
  type ConsensusDeck,
  type DeckViewCard,
} from './analytics';

describe('deckColorBreakdown', () => {
  const c = (pitch: number, quantity = 1) => ({ quantity, printingDetails: { pitch } });

  it('counts pitch 1/2/3 as red/yellow/blue, weighted by quantity', () => {
    const b = deckColorBreakdown([c(1, 3), c(1, 3), c(2, 1), c(3, 3), c(3, 3)]);
    expect(b).toEqual({ red: 6, yellow: 1, blue: 6, colorless: 0 });
  });

  it('counts pitch 0 / missing as colorless (equipment, hero)', () => {
    const b = deckColorBreakdown([{ quantity: 1, printingDetails: { pitch: 0 } }, { quantity: 1 }]);
    expect(b.colorless).toBe(2);
  });

  it('reads a flat pitch field too', () => {
    expect(deckColorBreakdown([{ quantity: 2, pitch: 3 }]).blue).toBe(2);
  });
});

describe('computeArchetypeConsensus', () => {
  const card = (name: string, pitch: number, quantity: number, cardUniqueId?: string, printingId?: string) =>
    ({ name, pitch, quantity, cardUniqueId, printingId: printingId ?? `pid_${name}` });

  const decks: ConsensusDeck[] = [
    { name: 'Deck A', cards: [card('Disable', 3, 3, 'u_dis'), card('Pummel', 1, 3, 'u_pum'), card('Overcrowded', 3, 1, 'u_ovr')] },
    { name: 'Deck B', cards: [card('Disable', 3, 3, 'u_dis'), card('Pummel', 1, 3, 'u_pum'), card('Headbutt', 1, 3, 'u_hb')] },
    { name: 'Deck C', cards: [card('Disable', 3, 3, 'u_dis'), card('Pummel', 1, 2, 'u_pum')] },
  ];

  it('carries a representative printingId per consensus card (for rail preview)', () => {
    const r = computeArchetypeConsensus(decks);
    expect(r.core.find((x) => x.name === 'Disable')?.printingId).toBe('pid_Disable');
    expect(r.flex.find((x) => x.name === 'Headbutt')?.printingId).toBe('pid_Headbutt');
  });

  it('carries a representative stored imageUrl per consensus card (first-seen wins)', () => {
    // Constructed printing_id CDN URLs 404 (images deleted 2026-07) — the
    // consensus must surface the stored image_url so previews render.
    const withImages: ConsensusDeck[] = [
      { name: 'Deck A', cards: [{ ...card('Disable', 3, 3, 'u_dis'), imageUrl: undefined }] },
      { name: 'Deck B', cards: [{ ...card('Disable', 3, 3, 'u_dis'), imageUrl: 'https://img/disable-b.png' }] },
      { name: 'Deck C', cards: [{ ...card('Disable', 3, 3, 'u_dis'), imageUrl: 'https://img/disable-c.png' }] },
    ];
    const r = computeArchetypeConsensus(withImages);
    // first deck that HAS an image wins
    expect(r.core.find((x) => x.name === 'Disable')?.imageUrl).toBe('https://img/disable-b.png');
  });

  it('marks cards present in every deck as core, with adoption and typical quantity', () => {
    const r = computeArchetypeConsensus(decks);
    expect(r.deckCount).toBe(3);
    const disable = r.core.find((x) => x.name === 'Disable');
    expect(disable).toMatchObject({ decks: 3, typicalQty: 3, pitch: 3 });
    // Pummel is in all 3 but quantities differ (3,3,2) → typical (mode) = 3
    expect(r.core.find((x) => x.name === 'Pummel')?.typicalQty).toBe(3);
  });

  it('marks cards present in some (not all) decks as flex, sorted by adoption desc', () => {
    const r = computeArchetypeConsensus(decks);
    const names = r.flex.map((x) => x.name);
    expect(names).toContain('Overcrowded');
    expect(names).toContain('Headbutt');
    // core never leaks into flex
    expect(names).not.toContain('Disable');
    expect(r.flex.every((x) => x.decks < r.deckCount)).toBe(true);
  });

  it('computes an average per-deck color curve', () => {
    const r = computeArchetypeConsensus(decks);
    // blue per deck: A=3(Disable)+1(Overcrowded)=4, B=3, C=3 → avg 3.33 → round 3
    // red per deck: A=3(Pummel), B=3+3(Headbutt)=6, C=2 → avg 3.67 → 4
    expect(r.colorCurve.blue).toBe(3);
    expect(r.colorCurve.red).toBe(4);
    expect(r.colorCurve.yellow).toBe(0);
  });

  it('returns empty report for no decks', () => {
    const r = computeArchetypeConsensus([]);
    expect(r).toEqual({ deckCount: 0, core: [], flex: [], colorCurve: { red: 0, yellow: 0, blue: 0 } });
  });

  it('carries card-intrinsic attributes (type/cost/power/defense/text) onto consensus cards', () => {
    // The AI context self-describes each card from these; they're identical
    // across decks (card-intrinsic), so the first occurrence populates them.
    const rich = {
      name: 'Disable', pitch: 3, quantity: 3, cardUniqueId: 'u_dis', printingId: 'pid_Disable',
      typeText: 'Generic Action', cost: 0, power: undefined, defense: 3,
      text: 'Your opponent cannot play instants during their next action phase.',
    };
    const bare = { name: 'Disable', pitch: 3, quantity: 3, cardUniqueId: 'u_dis', printingId: 'pid_Disable' };
    const r = computeArchetypeConsensus([
      { name: 'Deck A', cards: [rich] },
      { name: 'Deck B', cards: [bare] },
    ]);
    const disable = r.core.find((x) => x.name === 'Disable');
    expect(disable).toMatchObject({
      typeText: 'Generic Action', cost: 0, defense: 3,
      text: 'Your opponent cannot play instants during their next action phase.',
    });
  });
});

describe('groupDeckViewByPitch', () => {
  const cards: DeckViewCard[] = [
    { name: 'Heist', pitch: 1, quantity: 3 },
    { name: 'Cranial Crush', pitch: 3, quantity: 3 },
    { name: 'Remembrance', pitch: 2, quantity: 3 },
    { name: 'Aurum Aegis', quantity: 1 }, // no pitch → colorless (equipment)
    { name: 'Boulder Drop', pitch: 1, quantity: 3 },
  ];

  it('groups into red/yellow/blue/colorless sections in that order', () => {
    const sections = groupDeckViewByPitch(cards);
    expect(sections.map((s) => s.key)).toEqual(['red', 'yellow', 'blue', 'colorless']);
  });

  it('sorts cards within a section by name and omits empty sections', () => {
    const sections = groupDeckViewByPitch(cards);
    const red = sections.find((s) => s.key === 'red')!;
    expect(red.cards.map((c) => c.name)).toEqual(['Boulder Drop', 'Heist']);
    // only yellow card present; a pitch with no cards would be omitted
    expect(groupDeckViewByPitch([{ name: 'X', pitch: 2, quantity: 1 }]).map((s) => s.key)).toEqual(['yellow']);
  });
});
