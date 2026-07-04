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
  buildMessageWithContext,
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
  it('sections hero/equipment/maindeck with totals, previews, and compact context', () => {
    const card = (name: string, quantity: number, pitch?: number) => ({
      quantity,
      printingDetails: { display_name: name, pitch, image_url: `https://img/${name}` },
    });
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
    expect(result.lines[5]).toMatchObject({ text: '3× Overcrowded (pitch 3)' });
    expect(result.context).toContain('deck "Teklosaucen"');
    expect(result.context).toContain('Maindeck: 3x Overcrowded (p3)');
  });

  it('handles an empty deck', () => {
    expect(summarizeDeckContents({ name: 'Empty' }).lines).toEqual(['This deck is empty.']);
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
