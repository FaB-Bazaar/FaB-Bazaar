import { describe, it, expect } from 'vitest';
import {
  toPartnerCard,
  toPartnerBinder,
  toPartnerBinderItem,
  toPartnerDeckSummary,
  toPartnerDeck,
} from './mappers';

const printing = {
  printing_id: 'p-1',
  card_unique_id: 'c-1',
  name: 'command and conquer',
  display_name: 'Command and Conquer',
  pitch: 1,
  set: 'arc',
  collector_number: 'ARC159',
  edition: 'f',
  foiling: 'r',
  rarity: 'm',
  language: 'en',
  image_url: 'https://img.example/p-1',
  tcg_low: 61.5,
  tcg_market: 80,
  card_text: 'internal detail',
};

describe('partner API mappers', () => {
  it('maps a printing to the public card shape, priced at TCGplayer low', () => {
    expect(toPartnerCard(printing)).toEqual({
      printing_id: 'p-1',
      card_unique_id: 'c-1',
      name: 'Command and Conquer',
      pitch: 1,
      set: 'arc',
      collector_number: 'ARC159',
      edition: 'f',
      foiling: 'r',
      rarity: 'm',
      language: 'en',
      image_url: 'https://img.example/p-1',
      price_usd: 61.5,
    });
  });

  it('never substitutes the market price when there is no low price', () => {
    const card = toPartnerCard({ ...printing, tcg_low: undefined, pitch: undefined, image_url: '' });
    expect(card.price_usd).toBeNull();
    expect(card.pitch).toBeNull();
    expect(card.image_url).toBeNull();
  });

  it('reports language in lowercase whatever the source row used', () => {
    // Inventory rows store "EN"; printings store "en".
    expect(toPartnerCard({ ...printing, language: 'EN' }).language).toBe('en');
  });

  it('maps a binder with its totals', () => {
    const binder = toPartnerBinder({
      _id: 'b-1',
      userId: 'u-1',
      name: 'Trade binder',
      slug: 'trade',
      isPublic: true,
      visibility: { level: 'public' },
      updatedAt: new Date('2026-11-01T00:00:00Z'),
      stats: {
        totalQuantity: 12,
        totalValue: { tcg_low: 240.25, tcg_market: 400 },
      },
    } as never);
    expect(binder).toEqual({
      id: 'b-1',
      name: 'Trade binder',
      slug: 'trade',
      visibility: 'public',
      total_quantity: 12,
      total_value_usd: 240.25,
      updated_at: '2026-11-01T00:00:00.000Z',
    });
    expect(JSON.stringify(binder)).not.toContain('u-1');
  });

  it('maps a binder item without the owner or internal fields', () => {
    const item = toPartnerBinderItem({
      ...printing,
      _id: 'i-1',
      printingId: 'p-1',
      userId: 'u-1',
      discordId: '123',
      quantity: 3,
      condition: 'NM',
      forTrade: true,
    } as never);
    expect(item).toEqual({
      item_id: 'i-1',
      quantity: 3,
      condition: 'NM',
      for_trade: true,
      card: toPartnerCard(printing),
    });
  });

  it('maps a deck summary keyed by the public id', () => {
    expect(
      toPartnerDeckSummary({
        _id: 'internal-9',
        publicId: 'pub-9',
        userId: 'u-1',
        name: 'Dash IO',
        format: 'Classic Constructed',
        heroName: 'dash i/o',
        heroDisplayName: 'Dash I/O',
        visibility: 'unlisted',
        isPublic: true,
        totalCards: 80,
        estimatedValue: 512,
        updatedAt: new Date('2026-11-02T00:00:00Z'),
      } as never),
    ).toEqual({
      id: 'pub-9',
      name: 'Dash IO',
      format: 'Classic Constructed',
      hero: 'Dash I/O',
      visibility: 'unlisted',
      total_cards: 80,
      estimated_value_usd: 512,
      updated_at: '2026-11-02T00:00:00.000Z',
    });
  });

  it('maps a full deck into zones of cards', () => {
    const entry = { printingId: 'p-1', quantity: 2, printingDetails: printing };
    const deck = toPartnerDeck({
      _id: 'internal-9',
      publicId: 'pub-9',
      userId: 'u-1',
      name: 'Dash IO',
      format: 'Classic Constructed',
      heroName: 'dash i/o',
      visibility: 'private',
      isPublic: false,
      hero: [],
      equipment: [],
      maindeck: [entry],
      inventory: [{ printingId: 'p-2' }],
    } as never);

    expect(deck.id).toBe('pub-9');
    expect(deck.hero).toBe('dash i/o');
    expect(deck.zones.maindeck).toEqual([
      { printing_id: 'p-1', quantity: 2, card: toPartnerCard(printing) },
    ]);
    // An entry without printing details still reports what it is.
    expect(deck.zones.inventory).toEqual([{ printing_id: 'p-2', quantity: 1, card: null }]);
    expect(deck.zones.benched).toEqual([]);
    expect(deck.zones.tokens).toEqual([]);
  });
});
