import { describe, it, expect } from 'vitest';
import { buildDeckOverlayModel, isOverlayVisible, type OverlayDeckInput } from './deck-overlay';

function card(name: string, opts: { pitch?: number; quantity?: number; image?: string | null; types?: string[] } = {}) {
  return {
    printingId: `${name}-${opts.pitch ?? 'x'}-${Math.random()}`,
    quantity: opts.quantity,
    printingDetails: {
      name,
      pitch: opts.pitch,
      types: opts.types,
      image_url: opts.image === null ? undefined : (opts.image ?? `https://img.example/${encodeURIComponent(name)}.webp`),
    },
  };
}

function deck(overrides: Partial<OverlayDeckInput> = {}): OverlayDeckInput {
  return {
    name: 'Midrange Maxx',
    format: 'Classic Constructed',
    heroName: "Maxx 'The Hype' Nitro",
    visibility: 'unlisted',
    metafyGuideId: null,
    hero: [card("Maxx 'The Hype' Nitro")],
    equipment: [],
    maindeck: [],
    ...overrides,
  };
}

describe('isOverlayVisible', () => {
  it('hides private decks', () => {
    expect(isOverlayVisible(deck({ visibility: 'private' }))).toBe(false);
  });

  it('hides Metafy-gated decks even when public', () => {
    expect(isOverlayVisible(deck({ visibility: 'public', metafyGuideId: 'guide-1' }))).toBe(false);
  });

  it('shows public and unlisted decks', () => {
    expect(isOverlayVisible(deck({ visibility: 'public' }))).toBe(true);
    expect(isOverlayVisible(deck({ visibility: 'unlisted' }))).toBe(true);
  });
});

describe('buildDeckOverlayModel', () => {
  it('groups the maindeck by pitch in red, yellow, blue order with counts', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [
        card('Zipper Hit', { pitch: 3, quantity: 3 }),
        card('Crankshaft', { pitch: 1, quantity: 2 }),
        card('Fast and Furious', { pitch: 2, quantity: 1 }),
      ],
    }));

    expect(model.pitchGroups.map(g => [g.label, g.count])).toEqual([
      ['Red', 2],
      ['Yellow', 1],
      ['Blue', 3],
    ]);
    expect(model.maindeckCount).toBe(6);
  });

  it('omits empty pitch groups and puts pitchless cards last', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [
        card('Hyper Driver', { pitch: 0, quantity: 2 }),
        card('Crankshaft', { pitch: 1, quantity: 3 }),
        card('Teklo Leveler', { quantity: 1 }),
      ],
    }));

    expect(model.pitchGroups.map(g => g.label)).toEqual(['Red', 'No pitch']);
    expect(model.pitchGroups[1].count).toBe(3);
  });

  it('sorts cards by name within a pitch group', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [card('Zipper Hit', { pitch: 1 }), card('Assembly Module', { pitch: 1 }), card('Cog in the Machine', { pitch: 1 })],
    }));

    expect(model.pitchGroups[0].cards.map(c => c.name)).toEqual(['Assembly Module', 'Cog in the Machine', 'Zipper Hit']);
  });

  it('merges different printings of the same card and pitch into one row', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [
        card('Crankshaft', { pitch: 1, quantity: 2, image: 'https://img.example/rf.webp' }),
        card('Crankshaft', { pitch: 1, quantity: 1, image: 'https://img.example/cf.webp' }),
        card('Crankshaft', { pitch: 3, quantity: 3 }),
      ],
    }));

    const red = model.pitchGroups.find(g => g.pitch === 1)!;
    expect(red.cards).toEqual([{ name: 'Crankshaft', quantity: 3, pitch: 1, imageUrl: 'https://img.example/rf.webp' }]);
    expect(model.pitchGroups.find(g => g.pitch === 3)!.cards[0].quantity).toBe(3);
  });

  it('counts a printing with no quantity as one copy', () => {
    const model = buildDeckOverlayModel(deck({ maindeck: [card('Crankshaft', { pitch: 1 })] }));
    expect(model.pitchGroups[0].cards[0].quantity).toBe(1);
  });

  it('exposes hero, equipment and deck metadata', () => {
    const model = buildDeckOverlayModel(deck({
      equipment: [card('Teklo Foundry Heart'), card('Galvanic Bender')],
    }));

    expect(model.name).toBe('Midrange Maxx');
    expect(model.format).toBe('Classic Constructed');
    expect(model.hero?.name).toBe("Maxx 'The Hype' Nitro");
    expect(model.equipment.map(c => c.name)).toEqual(['Galvanic Bender', 'Teklo Foundry Heart']);
  });

  it('builds the spotlight as hero, then equipment, then maindeck, skipping cards without art', () => {
    const model = buildDeckOverlayModel(deck({
      equipment: [card('Galvanic Bender')],
      maindeck: [
        card('Zipper Hit', { pitch: 3 }),
        card('Crankshaft', { pitch: 1 }),
        card('No Art Card', { pitch: 1, image: null }),
      ],
    }));

    expect(model.spotlight.map(c => c.name)).toEqual([
      "Maxx 'The Hype' Nitro",
      'Galvanic Bender',
      'Crankshaft',
      'Zipper Hit',
    ]);
  });

  it('moves pitchless equipment and weapons stored in the maindeck zone into equipment', () => {
    const model = buildDeckOverlayModel(deck({
      equipment: [card('Banksy', { types: ['mechanologist', 'weapon', 'wrench', '2h'] })],
      maindeck: [
        card('Galvanic Bender', { types: ['mechanologist', 'equipment', 'arms'] }),
        card('Crankshaft', { pitch: 1, types: ['mechanologist', 'action'] }),
      ],
    }));

    expect(model.equipment.map(c => c.name)).toEqual(['Banksy', 'Galvanic Bender']);
    expect(model.pitchGroups.map(g => g.label)).toEqual(['Red']);
    expect(model.maindeckCount).toBe(1);
  });

  it('keeps pitched equipment (Evos) in the pitch groups — they are played from the deck', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [card('Evo Circuit Breaker', { pitch: 1, types: ['mechanologist', 'instant', 'equipment', 'evo', 'head'] })],
    }));

    expect(model.pitchGroups[0].cards.map(c => c.name)).toEqual(['Evo Circuit Breaker']);
    expect(model.equipment).toEqual([]);
  });

  it('groups the inventory by pitch, leaving out pitchless equipment', () => {
    const model = buildDeckOverlayModel(deck({
      inventory: [
        card('Gas Up', { pitch: 1, quantity: 2 }),
        card('Hyper Driver', { pitch: 3 }),
        card('Puffer Jacket', { types: ['mechanologist', 'equipment', 'chest'] }),
      ],
    }));

    expect(model.inventoryGroups.map(g => [g.label, g.count])).toEqual([['Red', 2], ['Blue', 1]]);
    expect(model.inventoryCount).toBe(3);
  });

  it('has an empty inventory when the deck has none', () => {
    const model = buildDeckOverlayModel(deck());
    expect(model.inventoryGroups).toEqual([]);
    expect(model.inventoryCount).toBe(0);
  });

  it('prefers the proper-cased display_name over the lowercase name key', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [{ printingId: 'p1', quantity: 1, printingDetails: { name: 'command and conquer', display_name: 'Command and Conquer', pitch: 1 } }],
    }));
    expect(model.pitchGroups[0].cards[0].name).toBe('Command and Conquer');
  });

  it('falls back to display_name when name is missing', () => {
    const model = buildDeckOverlayModel(deck({
      maindeck: [{ printingId: 'p1', quantity: 1, printingDetails: { display_name: 'Crankshaft', pitch: 1 } }],
    }));
    expect(model.pitchGroups[0].cards[0].name).toBe('Crankshaft');
  });
});
