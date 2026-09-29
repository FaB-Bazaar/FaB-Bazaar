import { describe, it, expect, vi } from 'vitest';
import { withDecklistSnapshots } from './decklist-snapshot';

const deck = {
  name: 'Midrange Maxx',
  fabraryUrl: 'https://fabrary.net/decks/x',
  hero: [], equipment: [], inventory: [],
  maindeck: [{ printingId: 'r1', quantity: 3, printingDetails: { name: 'Heist', pitch: 1, cost: 2, power: 5, defense: 3, types: ['action'], keywords: [] } }],
};

describe('withDecklistSnapshots (MCP add/update article section)', () => {
  it('freezes the deck into a decklist-block that asks for a snapshot', async () => {
    const fetchDeck = vi.fn().mockResolvedValue(deck);
    const [out] = await withDecklistSnapshots(
      [{ type: 'decklist-block', deckId: 'D1', snapshotLabel: 'Week of Calling: Atlanta' }],
      fetchDeck, new Date('2026-09-28T15:00:00Z'),
    );
    expect(fetchDeck).toHaveBeenCalledWith('D1');
    expect(out).not.toHaveProperty('snapshotLabel');
    expect(out.deckId).toBe('D1');
    expect(out.snapshot).toMatchObject({ label: 'Week of Calling: Atlanta', takenAt: '2026-09-28', title: 'Midrange Maxx', exportUrl: 'https://fabrary.net/decks/x' });
    expect(out.snapshot.sections[0]).toMatchObject({ label: 'LIBRARY — RED', totalCards: 3 });
  });

  it('leaves other sections, and decklists without a label, untouched (no fetch)', async () => {
    const fetchDeck = vi.fn();
    const input = [{ type: 'text', content: 'hi' }, { type: 'decklist-block', deckId: 'D1' }];
    expect(await withDecklistSnapshots(input, fetchDeck)).toEqual(input);
    expect(fetchDeck).not.toHaveBeenCalled();
  });

  it('a deck that cannot be loaded is an error, not a silently live list', async () => {
    await expect(withDecklistSnapshots([{ type: 'decklist-block', deckId: 'nope', snapshotLabel: 'x' }], vi.fn().mockResolvedValue(null)))
      .rejects.toThrow(/nope/);
  });
});
