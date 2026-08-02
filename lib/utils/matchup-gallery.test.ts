import { describe, it, expect } from 'vitest';
import {
  applySideboardToDeck,
  applySideboardToInventory,
  isGearPrinting,
  type MatchupGalleryCard,
} from './matchup-gallery';

const card = (
  talisharId: string,
  count: number,
  overrides: Partial<MatchupGalleryCard> = {}
): MatchupGalleryCard => ({
  talisharId,
  count,
  displayName: talisharId,
  printingId: `printing-${talisharId}`,
  imageUrl: `https://img.example/${talisharId}.webp`,
  ...overrides,
});

const byId = (cards: MatchupGalleryCard[]) =>
  new Map(cards.map(c => [c.talisharId, c]));

describe('isGearPrinting', () => {
  const printing = (types: string[]) => ({ printingDetails: { types } });

  it('marks weapons as gear', () => {
    expect(isGearPrinting(printing(['mechanologist', 'weapon', 'gun', '2h']))).toBe(true);
  });

  it('marks non-evo equipment as gear (sideboard equipment regression: Hyper-X3, Teklo Foundry Heart)', () => {
    expect(isGearPrinting(printing(['mechanologist', 'equipment', 'head']))).toBe(true);
    expect(isGearPrinting(printing(['mechanologist', 'equipment', 'chest']))).toBe(true);
  });

  it('keeps evo equipment out of gear — they are library cards', () => {
    expect(isGearPrinting(printing(['mechanologist', 'instant', 'equipment', 'evo', 'legs']))).toBe(false);
  });

  it('rejects non-gear cards and malformed printings', () => {
    expect(isGearPrinting(printing(['mechanologist', 'action', 'attack']))).toBe(false);
    expect(isGearPrinting({})).toBe(false);
    expect(isGearPrinting({ printingDetails: {} })).toBe(false);
  });

  it('is case-insensitive on type names', () => {
    expect(isGearPrinting(printing(['Mechanologist', 'Equipment', 'Head']))).toBe(true);
  });
});

describe('applySideboardToDeck', () => {
  const deck = [
    card('dash_io', 1),
    card('symbiosis_shot_red', 3),
    card('high_octane_red', 3),
  ];
  const inventory = [card('zap_blue', 2), card('t_bone_red', 3)];

  it('returns the deck unchanged when there are no sideboard swaps', () => {
    expect(applySideboardToDeck(deck, inventory, { in: [], out: [] })).toEqual(deck);
    expect(applySideboardToDeck(deck, inventory, undefined)).toEqual(deck);
  });

  it('removes sided-out copies and drops cards that reach zero', () => {
    const result = byId(
      applySideboardToDeck(deck, inventory, {
        in: [],
        out: ['high_octane_red', 'dash_io'],
      })
    );
    expect(result.get('high_octane_red')?.count).toBe(2);
    expect(result.has('dash_io')).toBe(false);
  });

  it('adds brought-in cards from inventory with their image url', () => {
    const result = byId(
      applySideboardToDeck(deck, inventory, {
        in: ['zap_blue', 'zap_blue', 'symbiosis_shot_red'],
        out: [],
      })
    );
    expect(result.get('zap_blue')).toMatchObject({
      count: 2,
      printingId: 'printing-zap_blue',
      imageUrl: 'https://img.example/zap_blue.webp',
    });
    expect(result.get('symbiosis_shot_red')?.count).toBe(4);
  });

  it('keeps image urls on untouched base-deck cards (Full Deck card-back regression)', () => {
    const result = applySideboardToDeck(deck, inventory, {
      in: ['zap_blue'],
      out: ['high_octane_red'],
    });
    for (const c of result) {
      expect(c.imageUrl, `${c.talisharId} lost its imageUrl`).toBeTruthy();
    }
  });

  it('falls back to the talishar id when a brought-in card is missing from inventory', () => {
    const result = byId(
      applySideboardToDeck(deck, inventory, { in: ['unknown_card_red'], out: [] })
    );
    expect(result.get('unknown_card_red')).toMatchObject({
      count: 1,
      displayName: 'unknown_card_red',
      printingId: 'unknown_card_red',
    });
  });
});

describe('applySideboardToInventory', () => {
  const deck = [card('dash_io', 1), card('high_octane_red', 3)];
  const inventory = [card('zap_blue', 2), card('t_bone_red', 3)];

  it('returns the inventory unchanged when there are no sideboard swaps', () => {
    expect(applySideboardToInventory(inventory, deck, { in: [], out: [] })).toEqual(inventory);
    expect(applySideboardToInventory(inventory, deck, undefined)).toEqual(inventory);
  });

  it('removes brought-in copies and adds sided-out deck cards to the pile', () => {
    const result = byId(
      applySideboardToInventory(inventory, deck, {
        in: ['zap_blue', 'zap_blue'],
        out: ['high_octane_red'],
      })
    );
    expect(result.has('zap_blue')).toBe(false);
    expect(result.get('high_octane_red')?.count).toBe(1);
    expect(result.get('t_bone_red')?.count).toBe(3);
  });

  it('carries the image url onto sided-out deck cards (set-aside card-back regression)', () => {
    const result = byId(
      applySideboardToInventory(inventory, deck, { in: [], out: ['high_octane_red'] })
    );
    expect(result.get('high_octane_red')?.imageUrl).toBe(
      'https://img.example/high_octane_red.webp'
    );
  });
});
