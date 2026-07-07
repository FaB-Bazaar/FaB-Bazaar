import { describe, it, expect } from 'vitest';
import { shapeCuratedListForMcp } from './getCuratedList';

describe('shapeCuratedListForMcp', () => {
  it('returns a table + widget shape when showDetails is true (default) and normalizes camelCase fields', () => {
    const raw = {
      success: true,
      list: {
        id: 'abc123',
        name: 'Prism Staples',
        heroName: 'Prism',
        format: 'CC',
        isPublished: true,
        description: 'Must-have cards for Prism.',
        cards: [
          {
            id: 'c1', printingId: 'p-channel',
            displayName: 'Channel Lake Frigid',
            setCode: 'ele', collectorNumber: '146',
            rarity: 'm', foiling: 'r', edition: 'f',
            tcgLow: 10, tcgMarket: 12.5,
            typeTextDisplay: 'Ice Wizard Action', pitch: 2,
            text: 'If Channel Lake Frigid is in your banished zone, you may play it this turn.',
            imageUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/p-channel/public',
          },
          {
            id: 'c2', printingId: 'p-heart',
            displayName: 'Heart of Ice',
            setCode: 'ele', collectorNumber: '144',
            rarity: 'l',
            tcgLow: 8,
          },
        ],
      },
    };

    const out = shapeCuratedListForMcp(raw);

    const text = out.content[0].text;
    expect(text).toContain("List 'Prism Staples'");
    expect(text).toContain('Hero: Prism · CC · Published');
    expect(text).toContain('Must-have cards for Prism.');
    expect(text).toMatch(/\| # \| Name \| Type \| Pitch \| Set \| Rarity \| Price \| Text \|/);
    expect(text).toContain('Channel Lake Frigid');
    expect(text).toContain('Ice Wizard Action');      // type column
    expect(text).toContain('banished zone');          // rules text column
    expect(text).toContain('Majestic');
    expect(text).toContain('Legendary');
    expect(text).toContain('$12.50'); // tcg_market wins
    expect(text).toContain('$8.00');  // tcg_low fallback

    expect(out.structuredContent?.title).toBe('Prism Staples');
    expect(out.structuredContent?.subtitle).toBe('Hero: Prism · CC · Published');
    expect(out.structuredContent?.filters).toEqual({ rarity: true, set: true });

    const c0 = out.structuredContent?.cards[0];
    expect(c0.name).toBe('Channel Lake Frigid');
    expect(c0.set).toBe('ele');
    expect(c0.collector_number).toBe('146');
    expect(c0.printingId).toBe('p-channel');
    expect(c0.tcg_low).toBe(10);
    expect(c0.image_url).toContain('imagedelivery.net');
  });

  it('omits the table when showDetails is false but keeps widget structuredContent', () => {
    const raw = {
      success: true,
      list: {
        id: 'abc', name: 'L', format: 'CC', isPublished: false,
        cards: [{ id: 'c1', printingId: 'p', displayName: 'Alpha', setCode: 'arr' }],
      },
    };
    const out = shapeCuratedListForMcp(raw, { showDetails: false });
    expect(out.content[0].text).not.toContain('|');
    expect(out.structuredContent?.cards).toHaveLength(1);
  });

  it('uses className scope when no hero is set', () => {
    const raw = {
      success: true,
      list: { id: 'x', name: 'Ninja Core', className: 'Ninja', format: 'Blitz', isPublished: false, cards: [] },
    };
    const out = shapeCuratedListForMcp(raw);
    expect(out.content[0].text).toContain('Class: Ninja · Blitz · Draft');
    expect(out.structuredContent?.subtitle).toBe('Class: Ninja · Blitz · Draft');
  });

  it('handles an empty list without a table', () => {
    const raw = {
      success: true,
      list: { id: 'x', name: 'Empty', format: 'CC', isPublished: false, cards: [] },
    };
    const out = shapeCuratedListForMcp(raw);
    expect(out.content[0].text).toContain('0 cards');
    expect(out.content[0].text).not.toContain('| # |');
    expect(out.structuredContent?.cards).toEqual([]);
  });

  it('passes errors through with isError flag and no structuredContent payload', () => {
    const raw = { success: false, error: 'List not found' };
    const out = shapeCuratedListForMcp(raw);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('List not found');
    expect(out.structuredContent).toBeUndefined();
  });
});
