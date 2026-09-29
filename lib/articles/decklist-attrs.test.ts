import { describe, it, expect } from 'vitest';
import { decklistBlockAttrs } from './decklist-attrs';

describe('decklistBlockAttrs (fab-decklist-block attributes for an article section)', () => {
  const snapshot = { label: 'Week of Calling: Atlanta', takenAt: '2026-09-28', sections: [{ label: 'LIBRARY — RED', cards: [] }] };

  it('passes the frozen snapshot through as JSON, next to the live deck id', () => {
    const attrs = decklistBlockAttrs({ type: 'decklist-block', deckId: 'D1', title: 'My list', snapshot }, { heroPublicId: 'A1' });
    expect(attrs['deck-id']).toBe('D1');
    expect(JSON.parse(attrs.snapshot!)).toEqual(snapshot);
    expect(attrs['hero-public-id']).toBe('A1');
    expect(attrs.title).toBe('My list');
  });

  it('keeps older sections (no snapshot) working exactly as before', () => {
    const attrs = decklistBlockAttrs({ type: 'decklist-block', deckId: 'D1', sections: '[]', exportUrl: 'x', notes: 'n' }, { articlePublicId: 'A2' });
    expect(attrs.snapshot).toBeUndefined();
    expect(attrs).toMatchObject({ 'deck-id': 'D1', sections: '[]', 'export-url': 'x', notes: 'n', 'article-public-id': 'A2', title: '' });
  });
});
