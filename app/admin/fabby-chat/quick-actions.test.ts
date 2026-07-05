/**
 * Unit tests for the quick-action formatters — the zero-token deterministic
 * path in the Fabby chat, the binder drill-down lines, and the lazy context
 * hand-off to the next AI turn.
 */

import { describe, it, expect } from 'vitest';
import {
  summarizeBinders,
  summarizeWantsCards,
  summarizeDecks,
  summarizeBinderCards,
  summarizeDeckContents,
  summarizeComparison,
  buildMessageWithContext,
  parseSearchResults,
  harvestCardsFromStructured,
  summarizeArchetypeConsensus,
} from './quick-actions';

describe('summarizeBinders', () => {
  it('produces drillable lines carrying binder id and name', () => {
    const result = summarizeBinders([
      { _id: 'b1', name: 'Pirate', slug: 'pirate' },
      { _id: 'b2', name: 'No Slug Binder', slug: null },
    ]);
    expect(result.title).toBe('Your binders (2)');
    expect(result.lines[0]).toEqual({ text: 'Pirate (pirate)', drill: { kind: 'binder', id: 'b1', name: 'Pirate' } });
    expect(result.lines[1]).toEqual({ text: 'No Slug Binder', drill: { kind: 'binder', id: 'b2', name: 'No Slug Binder' } });
    expect(result.context).toContain('Pirate [pirate]');
  });

  it('handles the empty state', () => {
    const result = summarizeBinders([]);
    expect(result.lines).toEqual(['No binders yet.']);
    expect(result.context).toContain('none');
  });
});

describe('summarizeWantsCards', () => {
  it('formats the legacy wants cards shape defensively, with hover previews', () => {
    const result = summarizeWantsCards([
      { display_name: 'Vigorous Smashup (Red)', quantity: 2, priority: 'high' },
      { name: 'Pummel' }, // missing quantity/priority must not crash
    ]);
    expect(result.lines[0]).toMatchObject({
      text: '2× Vigorous Smashup (Red) (high)',
      preview: { name: 'Vigorous Smashup (Red)' },
    });
    expect((result.lines[0] as any).preview.imageUrl).toBeTruthy();
    expect(result.lines[1]).toMatchObject({ text: '1× Pummel' });
    expect(result.title).toBe('Your wants (2)');
  });

  it('handles the empty state', () => {
    expect(summarizeWantsCards([]).lines).toEqual(['Your wants list is empty.']);
  });

  it('prefers display_name from printingDetails over the lowercase top-level name', () => {
    // The /api/wants route puts display_name only inside printingDetails; the
    // top-level `name` is the lowercase internal name.
    const result = summarizeWantsCards([
      { name: 'command and conquer', quantity: 1, printingDetails: { display_name: 'Command and Conquer' } } as any,
    ]);
    expect((result.lines[0] as any).text).toBe('1× Command and Conquer');
    expect(result.context).toContain('Command and Conquer');
  });
});

describe('summarizeDecks', () => {
  it('makes decks drillable by publicId, falling back to lowercase heroName', () => {
    const result = summarizeDecks([
      { publicId: 'pub1', name: 'CC Gravy', format: 'cc', heroDisplayName: 'Gravy Bones' },
      { name: 'Teklosaucen', format: 'Classic Constructed', heroName: 'teklovossen, esteemed magnate' },
    ]);
    expect(result.lines[0]).toEqual({
      text: 'CC Gravy — Gravy Bones (cc)',
      drill: { kind: 'deck', id: 'pub1', name: 'CC Gravy' },
    });
    // no publicId → plain line, no drill
    expect(result.lines[1]).toBe('Teklosaucen — teklovossen, esteemed magnate (Classic Constructed)');
  });
});

describe('summarizeDeckContents', () => {
  const card = (name: string, quantity: number, pitch?: number) => ({
    quantity,
    printingDetails: { display_name: name, pitch, image_url: `https://img/${name}` },
  });

  it('sections hero/equipment/maindeck with totals, pitch fields, and compact context', () => {
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      format: 'Classic Constructed',
      heroName: 'teklovossen, esteemed magnate',
      hero: [card('Teklovossen', 1)],
      equipment: [card('Teklo Leveler', 1)],
      maindeck: [card('Overcrowded', 3, 3)],
    });

    expect(result.title).toBe('Deck: Teklosaucen (Classic Constructed)');
    expect(result.lines).toContain('— Hero (1) —');
    expect(result.lines).toContainEqual(expect.objectContaining({ text: '1× Teklovossen', preview: expect.objectContaining({ name: 'Teklovossen' }) }));
    expect(result.lines).toContain('— Equipment (1) —');
    expect(result.lines).toContain('— Maindeck (3) —');
    expect(result.lines).toContainEqual(expect.objectContaining({ text: '3× Overcrowded', pitch: 3 }));
    expect(result.context).toContain('deck "Teklosaucen"');
    expect(result.context).toContain('Maindeck: 3x Overcrowded (p3)');
  });

  it('leads with a maindeck color breakdown (the instant "how many blue cards" answer)', () => {
    const result = summarizeDeckContents({
      name: 'Victor',
      maindeck: [card('Cranial Crush', 3, 3), card('Pummel', 3, 1), card('Remembrance', 3, 2)],
    });
    // First line summarizes the color curve, weighted by quantity.
    expect(result.lines[0]).toBe('🎨 Maindeck colors: 3 red · 3 yellow · 3 blue');
    // …and it's queued into the AI context too.
    expect(result.context).toContain('3 red');
  });

  it('exposes a cards[] array across sections for the deck-view overlay', () => {
    const result = summarizeDeckContents({
      name: 'Victor',
      equipment: [{ ...card('Aurum Aegis', 1), printingId: 'pid_aa' }],
      maindeck: [{ ...card('Cranial Crush', 3, 3), printingId: 'pid_cc' }],
    } as any);
    expect(result.cards?.find((c) => c.name === 'Cranial Crush')).toMatchObject({ printingId: 'pid_cc', quantity: 3, pitch: 3 });
    expect(result.cards?.find((c) => c.name === 'Aurum Aegis')).toMatchObject({ printingId: 'pid_aa', quantity: 1 });
  });

  it('prepends a collection-compare drill when the deck has a publicId', () => {
    const result = summarizeDeckContents({
      publicId: 'pub1',
      name: 'Teklosaucen',
      maindeck: [card('Overcrowded', 3, 3)],
    });
    expect(result.lines).toContainEqual(expect.objectContaining({
      drill: { kind: 'deck-compare', id: 'pub1', name: 'Teklosaucen' },
    }));
  });

  it('handles an empty deck', () => {
    expect(summarizeDeckContents({ name: 'Empty' }).lines).toEqual(['This deck is empty.']);
  });
});

describe('summarizeComparison', () => {
  it('sections missing (with cost) and partial, with an owned summary line', () => {
    const result = summarizeComparison('CC Gravy', {
      owned: [{ printingId: 'a', cardName: 'Owned Card', needed: 3, owned: 3 }],
      partial: [{ printingId: 'b', cardName: 'Half Card', needed: 3, owned: 1 }],
      missing: [{ printingId: 'c', cardName: 'Gone Card', needed: 2, tcgMarket: 5.5 }],
    });

    expect(result.title).toBe('You vs. CC Gravy');
    expect(result.lines[0]).toBe('— Missing (1 cards · ~$11.00) —');
    expect(result.lines[1]).toMatchObject({ text: '2× Gone Card · $5.50', preview: { printingId: 'c' } });
    expect(result.lines[2]).toBe('— Partial (1) —');
    expect(result.lines[3]).toMatchObject({ text: 'Half Card — own 1/3' });
    expect(result.lines[4]).toBe('✓ Fully owned: 1 cards');
    expect(result.context).toContain('missing 2x Gone Card');
    expect(result.context).toContain('~$11.00');
  });

  it('celebrates a fully owned deck', () => {
    const result = summarizeComparison('Deck', { owned: [{ printingId: 'a', cardName: 'X', needed: 1, owned: 1 }] });
    expect(result.lines[0]).toContain('You own everything');
  });

  it('carries pitch on missing/partial lines and a cards[] of what you still need', () => {
    const result = summarizeComparison('Victor', {
      partial: [{ printingId: 'b', cardName: 'Half Card', needed: 3, owned: 1, pitch: 2 }],
      missing: [{ printingId: 'c', cardName: 'Gone Card', needed: 2, tcgMarket: 5, pitch: 3 }],
    });
    // pitch flows onto the rendered lines (for the gem)
    expect(result.lines).toContainEqual(expect.objectContaining({ text: expect.stringContaining('Gone Card'), pitch: 3 }));
    expect(result.lines).toContainEqual(expect.objectContaining({ text: expect.stringContaining('Half Card'), pitch: 2 }));
    // overlay cards = missing (needed) + partial (shortage), with pitch + printingId
    const gone = result.cards?.find((c) => c.name === 'Gone Card');
    expect(gone).toMatchObject({ printingId: 'c', quantity: 2, pitch: 3 });
    const half = result.cards?.find((c) => c.name === 'Half Card');
    expect(half).toMatchObject({ printingId: 'b', quantity: 2, pitch: 2 }); // shortage 3-1=2
  });
});

describe('summarizeBinderCards', () => {
  it('formats contents with for-trade markers, previews, and a total line', () => {
    const result = summarizeBinderCards('Pirate', [
      { display_name: 'Gravy Bones, Shipwrecked Looter', quantity: 1 },
      { name: 'Salt the Wound', quantity: 3, forTrade: true },
    ], 56);
    expect(result.title).toBe('Binder: Pirate');
    expect(result.lines[0]).toMatchObject({
      text: '1× Gravy Bones, Shipwrecked Looter',
      preview: { name: 'Gravy Bones, Shipwrecked Looter' },
    });
    expect(result.lines[1]).toMatchObject({ text: '3× Salt the Wound · for trade' });
    expect(result.lines[2]).toBe('Total: 56 cards');
    expect(result.context).toContain('"Pirate"');
    expect(result.context).toContain('[for trade]');
  });

  it('handles an empty binder', () => {
    expect(summarizeBinderCards('Empty', [], 0).lines).toEqual(['This binder is empty.']);
  });
});

describe('parseSearchResults', () => {
  const printing = (name: string, price?: number) => ({
    printing_id: `id-${name}`,
    name,
    collector_number: 'WTR167',
    set: 'wtr',
    rarity: 'r',
    pitch: 1,
    price,
  });

  it('renders compact rows with rail previews from structured search results', () => {
    const parsed = parseSearchResults({
      results: [{ total: 4, printings: [printing('Snatch', 0.73), printing('Snag')] }],
    });
    expect(parsed?.total).toBe(4);
    expect(parsed?.shown).toBe(2);
    const first = parsed?.rows[0] as any;
    expect(first.text).toBe('Snatch — WTR WTR167 · r · $0.73');
    expect(first.pitch).toBe(1);
    expect(first.preview).toMatchObject({ name: 'Snatch', printingId: 'id-Snatch', priceLow: 0.73 });
    // no price → no price segment, no crash
    expect((parsed?.rows[1] as any).text).toContain('Snag — WTR');
  });

  it('caps rows at maxRows and reports the real total', () => {
    const parsed = parseSearchResults({
      results: [{ total: 500, printings: Array.from({ length: 30 }, (_, i) => printing(`Card${i}`)) }],
    }, 20);
    expect(parsed?.shown).toBe(20);
    expect(parsed?.total).toBe(500);
  });

  it('returns null for non-search or empty structured payloads', () => {
    expect(parseSearchResults({ title: 'x', url: 'y' })).toBeNull();
    expect(parseSearchResults({ results: [{ total: 0, printings: [] }] })).toBeNull();
    expect(parseSearchResults(undefined)).toBeNull();
  });

  it('surfaces printing_count as printingCount on a grouped representative row', () => {
    const parsed = parseSearchResults({
      results: [{ total: 1, printings: [{ ...printing('Maximum Velocity', 0.37), printing_count: 4 }] }],
    });
    expect((parsed?.rows[0] as any).printingCount).toBe(4);
  });

  it('omits printingCount when the card has a single printing', () => {
    const parsed = parseSearchResults({
      results: [{ total: 1, printings: [{ ...printing('Solo Card', 1), printing_count: 1 }] }],
    });
    expect((parsed?.rows[0] as any).printingCount).toBeUndefined();
  });
});

describe('harvestCardsFromStructured', () => {
  const byName = (cards: ReturnType<typeof harvestCardsFromStructured>, name: string) =>
    cards.find((c) => c.name === name);

  it('harvests search_printings results across every card group (not just the first)', () => {
    const cards = harvestCardsFromStructured({
      results: [
        { printings: [{ printing_id: 'p1', name: 'Pummel', pitch: 1 }] },
        { printings: [{ printing_id: 'p2', name: 'Sink Below', pitch: 3 }] },
      ],
    });
    expect(byName(cards, 'Pummel')?.preview.printingId).toBe('p1');
    expect(byName(cards, 'Sink Below')?.pitch).toBe(3);
  });

  it('harvests get_deck cards from hero, equipment and category sections', () => {
    const cards = harvestCardsFromStructured({
      deck: {
        heroCard: { printingId: 'h1', name: 'Victor Goldmane, High and Mighty', pitch: 0 },
        weapon: { printingId: 'w1', name: 'Titan Hammer', pitch: 0 },
        equipment: { head: [{ printingId: 'e1', name: 'Crown of Dominion', pitch: 0 }], other: [] },
        categories: {
          maindeck: [{ printingId: 'm1', name: 'Disable', pitch: 3 }, { printingId: 'm2', name: 'Pummel', pitch: 1 }],
          inventory: [], benched: [], tokens: [],
        },
      },
    });
    expect(byName(cards, 'Disable')?.preview.printingId).toBe('m1');
    expect(byName(cards, 'Disable')?.pitch).toBe(3);
    expect(byName(cards, 'Crown of Dominion')?.preview.printingId).toBe('e1');
    expect(byName(cards, 'Victor Goldmane, High and Mighty')).toBeTruthy();
  });

  it('harvests get_binder cards[] (printingId + name, no pitch)', () => {
    const cards = harvestCardsFromStructured({
      cards: [{ printingId: 'b1', name: 'Command and Conquer' }],
    });
    expect(byName(cards, 'Command and Conquer')?.preview.printingId).toBe('b1');
  });

  it('harvests get_wants cards[] with snake-case printing_id and display_name only', () => {
    const cards = harvestCardsFromStructured({
      cards: [{ printing_id: 'wt1', display_name: 'Enlightened Strike' }],
    });
    expect(byName(cards, 'Enlightened Strike')?.preview.printingId).toBe('wt1');
  });

  it('gives every harvested card a non-empty preview image and name', () => {
    const cards = harvestCardsFromStructured({ cards: [{ printingId: 'x1', name: 'Snatch' }] });
    expect(cards[0].preview.imageUrl.length).toBeGreaterThan(0);
    expect(cards[0].preview.name).toBe('Snatch');
  });

  it('returns [] for undefined / cardless payloads', () => {
    expect(harvestCardsFromStructured(undefined)).toEqual([]);
    expect(harvestCardsFromStructured({ title: 'x', url: 'y' })).toEqual([]);
  });
});

describe('summarizeArchetypeConsensus', () => {
  const data = {
    heroName: 'victor goldmane, high and mighty',
    format: 'cc',
    months: 3,
    consensus: {
      deckCount: 10,
      core: [
        { name: 'Cranial Crush', pitch: 3, decks: 10, typicalQty: 3, printingId: 'pid_cc' },
        { name: 'Aurum Aegis', decks: 10, typicalQty: 1, printingId: 'pid_aa' },
      ],
      flex: [
        { name: 'Disable', pitch: 3, decks: 9, typicalQty: 3, printingId: 'pid_dis' },
        { name: 'Pummel', pitch: 1, decks: 8, typicalQty: 3, printingId: 'pid_pum' },
      ],
      colorCurve: { red: 30, yellow: 12, blue: 30 },
    },
    decks: [],
  };

  it('titles with hero, deck count and window', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.title).toMatch(/victor goldmane/i);
    expect(r.title).toMatch(/10 decks/);
    expect(r.title).toMatch(/3 mo/);
  });

  it('leads with the average color curve', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.lines[0]).toBe('🎨 Avg colors: 30 red · 12 yellow · 30 blue');
  });

  it('renders core cards with quantity and pitch, and flex cards with adoption ratio', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.lines).toContainEqual(expect.objectContaining({ text: '3× Cranial Crush', pitch: 3 }));
    // flex shows how many of the N decks run it — the real outlier signal
    expect(r.lines).toContainEqual(expect.objectContaining({ text: '3× Disable — 9/10 decks', pitch: 3 }));
  });

  it('gives consensus cards a rail preview via their representative printingId', () => {
    const r = summarizeArchetypeConsensus(data);
    const cc = r.lines.find((l) => typeof l !== 'string' && l.text === '3× Cranial Crush') as any;
    expect(cc.preview).toMatchObject({ name: 'Cranial Crush', printingId: 'pid_cc' });
    expect(cc.preview.imageUrl).toBeTruthy();
  });

  it('exposes a cards[] array (printingId, qty, pitch, image) for the deck-view overlay', () => {
    const r = summarizeArchetypeConsensus(data);
    const cc = r.cards?.find((c) => c.name === 'Cranial Crush');
    expect(cc).toMatchObject({ printingId: 'pid_cc', quantity: 3, pitch: 3 });
    expect(cc?.imageUrl).toBeTruthy();
    // core + flex both included
    expect(r.cards?.some((c) => c.name === 'Disable')).toBe(true);
  });

  it('handles an empty result set', () => {
    const r = summarizeArchetypeConsensus({ ...data, consensus: { deckCount: 0, core: [], flex: [], colorCurve: { red: 0, yellow: 0, blue: 0 } } });
    expect(r.lines.join(' ')).toMatch(/no featured/i);
  });
});

describe('buildMessageWithContext', () => {
  it('passes the message through when nothing is queued', () => {
    expect(buildMessageWithContext([], 'hello')).toBe('hello');
  });

  it('prepends queued context blocks before the user text', () => {
    const message = buildMessageWithContext(
      ["The user's binders (name, slug): Pirate [pirate]"],
      'which of these is worth the most?',
    );
    expect(message).toContain('[Context');
    expect(message).toContain('Pirate [pirate]');
    expect(message.endsWith('which of these is worth the most?')).toBe(true);
  });
});
