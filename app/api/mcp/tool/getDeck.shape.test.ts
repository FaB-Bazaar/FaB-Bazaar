import { describe, it, expect } from 'vitest';
import { shapeDeckForMcp } from './getDeck';

function card(overrides: Partial<any> & { printingDetails?: any }) {
  return {
    printingId: overrides.printingId ?? 'p_' + Math.random().toString(36).slice(2, 10),
    quantity: overrides.quantity ?? 1,
    printingDetails: {
      display_name: 'Card',
      name: 'card',
      set: 'WTR',
      collector_number: '001',
      edition: 'u',
      foiling: 's',
      rarity: 'c',
      image_url: 'https://imagedelivery.net/abc/card/default',
      pitch: 0,
      cost: 0,
      types: [],
      keywords: [],
      classes: [],
      talents: [],
      ...(overrides.printingDetails ?? {}),
    },
  };
}

const rawDeckResult = {
  success: true,
  estimatedValue: 42.5,
  deck: {
    name: 'Katsu Aggro',
    publicId: 'pub_abc123',
    format: 'Blitz',
    heroName: 'Katsu, the Wanderer',
    description: 'Fast ninja deck.',
    eventName: 'Road to Nationals',
    eventDate: '2026-03-15',
    placing: '1st',
    totalCards: 40,
    metadata: {
      matchups: [
        {
          heroId: 'dash_io',
          preferredTurnOrder: 'second',
          notes: 'Block aggressively turn one.',
          sideboard: {
            in: ['fabricate_red', 'fabricate_red', 'evo_magneto_blue'],
            out: ['adaptive_dissolver', 'adaptive_dissolver', 'teklo_foundry_heart'],
          },
        },
      ],
    },
    categories: {
      hero: [
        card({
          printingId: 'p_hero',
          printingDetails: {
            display_name: 'Katsu, the Wanderer',
            types: ['hero'],
            classes: ['ninja'],
            talents: [],
          },
        }),
      ],
      equipment: [
        card({
          printingId: 'p_weapon',
          printingDetails: {
            display_name: 'Harmonized Kodachi',
            types: ['weapon', '1h'],
          },
        }),
        card({
          printingId: 'p_head',
          printingDetails: {
            display_name: 'Breaking Scales',
            types: ['equipment', 'head'],
          },
        }),
        card({
          printingId: 'p_chest',
          printingDetails: {
            display_name: 'Breaking Scales Chest',
            types: ['equipment', 'chest'],
          },
        }),
      ],
      maindeck: [
        card({
          quantity: 3,
          printingDetails: {
            display_name: 'Surging Strike',
            types: ['attack action', 'ninja'],
            pitch: 3,
            cost: 0,
            keywords: ['go again'],
          },
        }),
        card({
          quantity: 3,
          printingDetails: {
            display_name: 'Flick Knives',
            types: ['attack action', 'ninja'],
            pitch: 1,
            cost: 0,
            keywords: ['go again', 'combo'],
          },
        }),
        card({
          quantity: 2,
          printingDetails: {
            display_name: 'Sink Below',
            types: ['defense reaction'],
            pitch: 3,
            cost: 0,
          },
        }),
      ],
      inventory: [],
      benched: [],
      tokens: [],
    },
  },
};

describe('shapeDeckForMcp', () => {
  it('returns an error envelope when the handler failed', () => {
    const result = shapeDeckForMcp({ success: false, error: 'not found' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
    expect(result.structuredContent).toBeUndefined();
  });

  it('shapes the deck into a widget-friendly structure', () => {
    const result = shapeDeckForMcp(rawDeckResult);
    expect(result.isError).toBeUndefined();

    const sc: any = result.structuredContent;
    expect(sc).toBeDefined();
    expect(sc.title).toBe('Katsu Aggro');
    expect(sc.subtitle).toContain('Katsu, the Wanderer');
    expect(sc.subtitle).toContain('Blitz');
    expect(sc.url).toBe('https://fabbazaar.app/decks/pub_abc123');
    expect(sc.tool).toEqual({ name: 'get_deck', baseArgs: { deckName: 'Katsu Aggro' } });

    expect(sc.deck.meta.name).toBe('Katsu Aggro');
    expect(sc.deck.meta.className).toBe('ninja');
    expect(sc.deck.meta.estimatedValue).toBe(42.5);
    expect(sc.deck.meta.event).toBe('Road to Nationals');
    expect(sc.deck.meta.placing).toBe('1st');
  });

  it('excludes the hero card from the meta.totalCards count', () => {
    const { structuredContent: sc }: any = shapeDeckForMcp(rawDeckResult);
    // equipment 3 (weapon + head + chest) + maindeck 8 (3+3+2) = 11
    expect(sc.deck.meta.totalCards).toBe(11);
    expect(sc.deck.meta.maindeckCount).toBe(8);
  });

  it('separates weapon and equipment slots', () => {
    const { structuredContent: sc }: any = shapeDeckForMcp(rawDeckResult);
    expect(sc.deck.weapon?.name).toBe('Harmonized Kodachi');
    expect(sc.deck.equipment.head).toHaveLength(1);
    expect(sc.deck.equipment.head[0].name).toBe('Breaking Scales');
    expect(sc.deck.equipment.chest).toHaveLength(1);
    expect(sc.deck.equipment.arms).toHaveLength(0);
    expect(sc.deck.equipment.legs).toHaveLength(0);
    expect(sc.deck.equipment['off-hand']).toHaveLength(0);
    expect(sc.deck.equipment.other).toHaveLength(0);
  });

  it('computes maindeck stats (pitch, cost, type, keyword)', () => {
    const { structuredContent: sc }: any = shapeDeckForMcp(rawDeckResult);
    const stats = sc.deck.stats;
    expect(stats.totalCards).toBe(8); // 3 + 3 + 2
    expect(stats.byPitch['3']).toBe(5); // Surging Strike ×3 + Sink Below ×2
    expect(stats.byPitch['1']).toBe(3); // Flick Knives
    expect(stats.byCost['0']).toBe(8);
    expect(stats.byType['Attack Actions']).toBe(6);
    expect(stats.byType['Defense Reactions']).toBe(2);
    expect(stats.byKeyword['go again']).toBe(6);
    expect(stats.byKeyword['combo']).toBe(3);
  });

  it('normalizes matchups with humanized hero display', () => {
    const { structuredContent: sc }: any = shapeDeckForMcp(rawDeckResult);
    expect(sc.deck.matchups).toHaveLength(1);
    const m = sc.deck.matchups[0];
    expect(m.heroId).toBe('dash_io');
    expect(m.heroDisplay).toBe('Dash Io');
    expect(m.turnOrder).toBe('second');
    expect(m.notes).toBe('Block aggressively turn one.');
  });

  it('aggregates talishar sideboard identifiers into human-readable entries', () => {
    const { structuredContent: sc }: any = shapeDeckForMcp(rawDeckResult);
    const m = sc.deck.matchups[0];
    // in: fabricate_red ×2, evo_magneto_blue ×1
    expect(m.sideboard.in).toEqual([
      { id: 'fabricate_red', name: 'Fabricate', pitch: 1, quantity: 2 },
      { id: 'evo_magneto_blue', name: 'Evo Magneto', pitch: 3, quantity: 1 },
    ]);
    // out: adaptive_dissolver ×2 (no pitch suffix), teklo_foundry_heart ×1
    expect(m.sideboard.out).toEqual([
      { id: 'adaptive_dissolver', name: 'Adaptive Dissolver', pitch: 0, quantity: 2 },
      { id: 'teklo_foundry_heart', name: 'Teklo Foundry Heart', pitch: 0, quantity: 1 },
    ]);
  });

  it('classifies split-token types as attack actions, not generic actions', () => {
    const result = shapeDeckForMcp({
      success: true,
      deck: {
        name: 'Split Token Deck',
        publicId: 'pub_split',
        format: 'Classic Constructed',
        heroName: 'Uzuri, Switchblade',
        categories: {
          hero: [card({ printingId: 'p_hero', printingDetails: { types: ['hero'] } })],
          equipment: [],
          maindeck: [
            card({
              quantity: 3,
              printingDetails: {
                display_name: 'Twinning Blade',
                // service emits types as separate tokens for some printings
                types: ['attack', 'action', 'assassin'],
                pitch: 1,
                keywords: ['go again'],
              },
            }),
          ],
          inventory: [], benched: [], tokens: [],
        },
      },
    });
    const sc: any = result.structuredContent;
    expect(sc.deck.stats.byType['Attack Actions']).toBe(3);
    expect(sc.deck.stats.byType['Actions']).toBeUndefined();
  });

  it('omits the full decklist text when showDetails is false', () => {
    const withDetails = shapeDeckForMcp(rawDeckResult, { showDetails: true });
    const withoutDetails = shapeDeckForMcp(rawDeckResult, { showDetails: false });
    expect(withoutDetails.content[0].text.length).toBeLessThan(
      withDetails.content[0].text.length,
    );
  });
});

describe('shapeDeckForMcp — zone labels in the text rendering', () => {
  const withZones = {
    ...rawDeckResult,
    deck: {
      ...rawDeckResult.deck,
      categories: {
        ...rawDeckResult.deck.categories,
        inventory: [card({ quantity: 2, printingDetails: { display_name: 'Command and Conquer', pitch: 1, types: ['attack action'] } })],
        benched: [card({ quantity: 1, printingDetails: { display_name: 'Enlightened Strike', pitch: 1, types: ['attack action'] } })],
      },
    },
  };

  it('labels inventory as the sideboard so callers use the right zone name', () => {
    const text = shapeDeckForMcp(withZones).content[0].text as string;
    expect(text).toMatch(/\*\*Inventory \(sideboard\)\*\* \(2\)/);
    expect(text).toContain('Command and Conquer');
  });

  it('renders benched cards as a maybe-pile section, separate from inventory', () => {
    const text = shapeDeckForMcp(withZones).content[0].text as string;
    expect(text).toMatch(/\*\*Benched \(maybe-pile, not in the playable deck\)\*\* \(1\)/);
    expect(text).toContain('Enlightened Strike');
  });
});
