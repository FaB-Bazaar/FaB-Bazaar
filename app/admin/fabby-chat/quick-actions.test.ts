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
    expect(result.lines[0]).toBe('— Hero (1) —');
    expect(result.lines[1]).toMatchObject({ text: '1× Teklovossen', preview: { name: 'Teklovossen' } });
    expect(result.lines[2]).toBe('— Equipment (1) —');
    expect(result.lines[4]).toBe('— Maindeck (3) —');
    expect(result.lines[5]).toMatchObject({ text: '3× Overcrowded', pitch: 3 });
    expect(result.context).toContain('deck "Teklosaucen"');
    expect(result.context).toContain('Maindeck: 3x Overcrowded (p3)');
  });

  it('prepends a collection-compare drill when the deck has a publicId', () => {
    const result = summarizeDeckContents({
      publicId: 'pub1',
      name: 'Teklosaucen',
      maindeck: [card('Overcrowded', 3, 3)],
    });
    expect(result.lines[0]).toMatchObject({
      drill: { kind: 'deck-compare', id: 'pub1', name: 'Teklosaucen' },
    });
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
