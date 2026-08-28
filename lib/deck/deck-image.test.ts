// Pure model + layout for the "Export image" deck snapshot (More menu).
// The canvas renderer is browser-only; everything it needs to decide WHAT
// to draw and WHERE lives here so it can be pinned in node tests.
import { describe, expect, test } from 'vitest';
import { buildDeckImageModel, layoutDeckImage, type DeckImageModel } from './deck-image';
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService';

function row(over: {
  id: string; name: string; qty?: number; pitch?: number | null; image?: string | null; printingId?: string;
}): DeckPrintingDTO {
  return {
    printingId: over.printingId ?? `p-${over.id}`,
    quantity: over.qty ?? 1,
    printingDetails: {
      card_unique_id: over.id,
      name: over.name.toLowerCase(),
      display_name: over.name,
      pitch: over.pitch === undefined ? 1 : over.pitch ?? undefined,
      image_url: over.image === undefined ? `https://img/${over.id}` : over.image ?? undefined,
    },
  };
}

function deck(over: Partial<DeckDTO> = {}): DeckDTO {
  return {
    _id: 'x', publicId: 'pub123', userId: 'u1', name: 'Gherkin', format: 'cc',
    heroName: 'Teklovossen, Esteemed Magnate', visibility: 'public', isPublic: true,
    hero: [row({ id: 'hero', name: 'Teklovossen, Esteemed Magnate', pitch: null, image: 'https://img/hero' })],
    equipment: [], maindeck: [], inventory: [],
    ...over,
  } as DeckDTO;
}

const ORIGIN = 'https://fabbazaar.app';

describe('buildDeckImageModel', () => {
  test('merges printings of the same card into one entry and sums quantities', () => {
    const model = buildDeckImageModel(deck({
      maindeck: [
        row({ id: 'sink', name: 'Sink Below', qty: 2, pitch: 3, printingId: 'a' }),
        row({ id: 'sink', name: 'Sink Below', qty: 1, pitch: 3, printingId: 'b' }),
      ],
    }), { origin: ORIGIN });
    const blue = model.sections.find(s => s.key === 'blue')!;
    expect(blue.cards).toEqual([
      { name: 'Sink Below', imageUrl: 'https://img/sink', quantity: 3, pitch: 3 },
    ]);
  });

  test('groups the maindeck by pitch, sorts by name, and drops empty sections', () => {
    const model = buildDeckImageModel(deck({
      equipment: [row({ id: 'eq', name: 'Teklo Leveler', pitch: null })],
      maindeck: [
        row({ id: 'r2', name: 'War Machine', pitch: 1 }),
        row({ id: 'r1', name: 'Fabricate', pitch: 1 }),
        row({ id: 'b1', name: 'Ripple Away', pitch: 3 }),
        row({ id: 'np', name: 'Pulsewave Protocol', pitch: null }),
      ],
    }), { origin: ORIGIN });
    expect(model.sections.map(s => s.key)).toEqual(['equipment', 'red', 'blue', 'no-pitch']);
    expect(model.sections.find(s => s.key === 'red')!.cards.map(c => c.name)).toEqual(['Fabricate', 'War Machine']);
  });

  test('pitch counts scan equipment + maindeck + inventory (equipment counts as no pitch)', () => {
    const model = buildDeckImageModel(deck({
      equipment: [row({ id: 'eq', name: 'Teklo Leveler', pitch: null }), row({ id: 'eq2', name: 'Arms', pitch: null, qty: 2 })],
      maindeck: [row({ id: 'r', name: 'Fabricate', pitch: 1, qty: 3 }), row({ id: 'y', name: 'Pulse', pitch: 2 })],
      inventory: [row({ id: 'b', name: 'Thwart', pitch: 3, qty: 2 })],
    }), { origin: ORIGIN });
    expect(model.pitch).toEqual({ red: 3, yellow: 1, blue: 2, none: 3 });
    expect(model.totalCards).toBe(9);
  });

  test('includes inventory by default and omits it when includeInventory is false', () => {
    const d = deck({ inventory: [row({ id: 'b', name: 'Thwart', pitch: 3 })] });
    expect(buildDeckImageModel(d, { origin: ORIGIN }).sections.map(s => s.key)).toContain('inventory');
    const without = buildDeckImageModel(d, { origin: ORIGIN, includeInventory: false });
    expect(without.sections.map(s => s.key)).not.toContain('inventory');
    // The stat strip still describes the full box, not the visible sections.
    expect(without.pitch.blue).toBe(1);
  });

  test('header comes from the hero card, with deck.heroName as the fallback', () => {
    const model = buildDeckImageModel(deck({ ownerUsername: 'mistercakes' } as Partial<DeckDTO>), { origin: ORIGIN });
    expect(model.heroName).toBe('Teklovossen, Esteemed Magnate');
    expect(model.heroImageUrl).toBe('https://img/hero');
    expect(model.deckUrl).toBe('https://fabbazaar.app/decks/pub123');
    expect(model.ownerUsername).toBe('mistercakes');

    const noHeroCard = buildDeckImageModel(deck({ hero: [], heroName: 'Dash' }), { origin: ORIGIN });
    expect(noHeroCard.heroName).toBe('Dash');
    expect(noHeroCard.heroImageUrl).toBeNull();
  });

  test('a card without an image url renders as null (placeholder), never a printing-id CDN link', () => {
    const model = buildDeckImageModel(deck({ maindeck: [row({ id: 'r', name: 'Fabricate', pitch: 1, image: null })] }), { origin: ORIGIN });
    expect(model.sections[0].cards[0].imageUrl).toBeNull();
  });
});

describe('layoutDeckImage', () => {
  const model: DeckImageModel = {
    name: 'Gherkin', format: 'cc', heroName: 'Tek', heroImageUrl: null, ownerUsername: null,
    deckUrl: 'https://fabbazaar.app/decks/pub123', totalCards: 10,
    pitch: { red: 10, yellow: 0, blue: 0, none: 0 },
    sections: [
      { key: 'red', title: 'Red', accent: '#f87171', cards: Array.from({ length: 10 }, (_, i) => ({ name: `c${i}`, imageUrl: null, quantity: 1, pitch: 1 })) },
      { key: 'blue', title: 'Blue', accent: '#60a5fa', cards: [{ name: 'b', imageUrl: null, quantity: 3, pitch: 3 }] },
    ],
  };

  test('wraps cards into rows of `columns` with a 63:88 card aspect and no overlap', () => {
    const layout = layoutDeckImage(model, { width: 1000, columns: 4 });
    const red = layout.sections[0];
    expect(red.cards).toHaveLength(10);
    const xs = new Set(red.cards.map(c => c.x));
    expect(xs.size).toBe(4);
    // Row 2 starts strictly below row 1.
    expect(red.cards[4].y).toBeGreaterThanOrEqual(red.cards[0].y + red.cards[0].h);
    expect(red.cards[0].h / red.cards[0].w).toBeCloseTo(88 / 63, 2);
    // Everything stays inside the canvas.
    for (const c of red.cards) expect(c.x + c.w).toBeLessThanOrEqual(1000);
  });

  test('sections stack vertically and the canvas height covers the last card', () => {
    const layout = layoutDeckImage(model, { width: 1000, columns: 4 });
    const [red, blue] = layout.sections;
    const redBottom = Math.max(...red.cards.map(c => c.y + c.h));
    expect(blue.titleY).toBeGreaterThan(redBottom);
    expect(blue.cards[0].y).toBeGreaterThan(blue.titleY);
    const blueBottom = blue.cards[0].y + blue.cards[0].h;
    expect(layout.height).toBeGreaterThan(blueBottom);
    expect(layout.width).toBe(1000);
  });
});
