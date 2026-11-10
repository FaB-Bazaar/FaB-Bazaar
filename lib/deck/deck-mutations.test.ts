/**
 * Deck card mutations shared by the rail deck page and the classic page.
 *
 * The bulk add route answers 200 with per-row outcomes, so a copy-cap or
 * legality rejection is NOT an envelope failure. A move is remove-then-add:
 * if the add is rejected the copies must go back where they came from, or the
 * cards silently leave the deck.
 */
import { describe, it, expect, vi } from 'vitest';
import { addCopies, createSettleTracker, mergeServerDeck, moveCopies, removeCopies, withQuantity, type DeckMutationClient } from './deck-mutations';

const okAdd = (printingId: string) => ({ success: true as const, data: { results: [{ printingId, success: true }] } });
const rowRejected = (printingId: string, error: string) => ({ success: true as const, data: { results: [{ printingId, success: false, error }] } });

function client(overrides: Partial<DeckMutationClient> = {}): DeckMutationClient {
  return {
    addPrintings: vi.fn(async (_deckId, rows) => okAdd(rows[0].printingId)),
    removePrinting: vi.fn(async () => ({ success: true as const, data: { success: true } })),
    ...overrides,
  } as DeckMutationClient;
}

describe('addCopies', () => {
  it('reports a per-row rejection as a failure', async () => {
    const c = client({ addPrintings: vi.fn(async () => rowRejected('p1', 'Copy limit reached')) as any });
    expect(await addCopies(c, 'deck', 'p1', 'maindeck', 1)).toEqual({ ok: false, error: 'Copy limit reached' });
  });

  it('reports an envelope failure', async () => {
    const c = client({ addPrintings: vi.fn(async () => ({ success: false, error: 'Not allowed' })) as any });
    expect(await addCopies(c, 'deck', 'p1', 'maindeck', 1)).toEqual({ ok: false, error: 'Not allowed' });
  });

  it('succeeds when the row was added', async () => {
    expect(await addCopies(client(), 'deck', 'p1', 'maindeck', 2)).toEqual({ ok: true });
  });
});

// The bulk add route returns the updated deck. Using it saves the page a
// second request (GET deck) after every add.
describe('addCopies hands back the deck the server returned', () => {
  const serverDeck = { id: 'd1', maindeck: [{ printingId: 'p1', quantity: 1 }] };

  it('returns the deck on success', async () => {
    const c = client({ addPrintings: vi.fn(async () => ({ success: true, data: { results: [{ printingId: 'p1', success: true }], deck: serverDeck } })) as any });
    expect(await addCopies(c, 'deck', 'p1', 'maindeck', 1)).toEqual({ ok: true, deck: serverDeck });
  });

  it('returns no deck when the row was rejected', async () => {
    const c = client({ addPrintings: vi.fn(async () => ({ success: true, data: { results: [{ printingId: 'p1', success: false, error: 'Copy limit reached' }], deck: serverDeck } })) as any });
    expect(await addCopies(c, 'deck', 'p1', 'maindeck', 1)).toEqual({ ok: false, error: 'Copy limit reached' });
  });
});

// GET /api/decks/[id] decorates the deck for the viewer (canEdit, isCoOwner,
// ownerUsername); the add route's deck is the bare DTO. Merging keeps those.
describe('mergeServerDeck', () => {
  const current = { id: 'd1', name: 'Old', canEdit: true, isCoOwner: false, ownerUsername: 'eko', maindeck: [] } as any;
  const fresh = { id: 'd1', name: 'Old', maindeck: [{ printingId: 'p1', quantity: 1 }] } as any;

  it('takes the cards from the server deck', () => {
    expect(mergeServerDeck(current, fresh).maindeck).toEqual(fresh.maindeck);
  });

  it('keeps the viewer fields the add route does not send', () => {
    const merged = mergeServerDeck(current, fresh) as any;
    expect([merged.canEdit, merged.isCoOwner, merged.ownerUsername]).toEqual([true, false, 'eko']);
  });

  it('is the server deck when nothing is loaded yet', () => {
    expect(mergeServerDeck(null, fresh)).toBe(fresh);
  });
});

describe('removeCopies', () => {
  it("removes the whole row for 'all'", async () => {
    const c = client();
    await removeCopies(c, 'deck', 'p1', 'inventory', 'all');
    expect(c.removePrinting).toHaveBeenCalledWith('deck', 'p1', 'inventory', 999999);
  });
});

describe('moveCopies', () => {
  it('removes from the source zone, then adds to the target', async () => {
    const c = client();
    expect(await moveCopies(c, 'deck', 'p1', 'maindeck', 'inventory', 2)).toEqual({ ok: true });
    expect(c.removePrinting).toHaveBeenCalledWith('deck', 'p1', 'maindeck', 2);
    expect(c.addPrintings).toHaveBeenCalledWith('deck', [{ printingId: 'p1', quantity: 2, category: 'inventory' }]);
  });

  it('does not add when the remove fails', async () => {
    const c = client({ removePrinting: vi.fn(async () => ({ success: false, error: 'Nope' })) as any });
    expect(await moveCopies(c, 'deck', 'p1', 'maindeck', 'inventory', 1)).toEqual({ ok: false, error: 'Nope' });
    expect(c.addPrintings).not.toHaveBeenCalled();
  });

  it('puts the copies back when the target zone rejects the row', async () => {
    const addPrintings = vi.fn()
      .mockResolvedValueOnce(rowRejected('p1', 'Copy limit reached'))
      .mockResolvedValueOnce(okAdd('p1'));
    const c = client({ addPrintings: addPrintings as any });

    const outcome = await moveCopies(c, 'deck', 'p1', 'benched', 'maindeck', 3);

    expect(outcome).toEqual({ ok: false, error: 'Copy limit reached' });
    expect(addPrintings).toHaveBeenLastCalledWith('deck', [{ printingId: 'p1', quantity: 3, category: 'benched' }]);
  });

  it('says so when the copies could not be put back', async () => {
    const addPrintings = vi.fn().mockResolvedValue(rowRejected('p1', 'Copy limit reached'));
    const c = client({ addPrintings: addPrintings as any });

    const outcome = await moveCopies(c, 'deck', 'p1', 'benched', 'maindeck', 1);

    expect(outcome.ok).toBe(false);
    expect((outcome as { error: string }).error).toMatch(/removed from the deck/i);
  });
});

describe('withQuantity', () => {
  const deck = { maindeck: [{ printingId: 'p1', quantity: 2 }, { printingId: 'p2', quantity: 1 }], inventory: [] } as any;

  it('sets a new quantity on the row', () => {
    expect(withQuantity(deck, 'p1', 'maindeck', 3).maindeck[0].quantity).toBe(3);
    expect(deck.maindeck[0].quantity).toBe(2);
  });

  it('drops the row at zero', () => {
    expect(withQuantity(deck, 'p2', 'maindeck', 0).maindeck.map((c: any) => c.printingId)).toEqual(['p1']);
  });

  it('returns the same deck when the row is not there', () => {
    expect(withQuantity(deck, 'missing', 'maindeck', 1)).toBe(deck);
  });
});

// Clicking +1 three times fast puts three requests in flight, and their
// responses can land in any order. A deck taken from one of them may be older
// than what is on screen — so overlapping mutations end with ONE fresh fetch
// instead of each applying its own response.
describe('createSettleTracker', () => {
  it('a mutation on its own applies the deck its response carried', () => {
    const t = createSettleTracker();
    t.begin();
    expect(t.end()).toBe('apply');
  });

  it('overlapping mutations wait, then the last one to finish refetches', () => {
    const t = createSettleTracker();
    t.begin();
    t.begin();
    expect(t.end()).toBe('wait');
    expect(t.end()).toBe('refetch');
  });

  it('goes back to applying once the overlap has cleared', () => {
    const t = createSettleTracker();
    t.begin(); t.begin(); t.end(); t.end();
    t.begin();
    expect(t.end()).toBe('apply');
  });

  it('a mutation that starts while others are settling still ends in a refetch', () => {
    const t = createSettleTracker();
    t.begin();
    t.begin();
    expect(t.end()).toBe('wait');
    t.begin();
    expect(t.end()).toBe('wait');
    expect(t.end()).toBe('refetch');
  });
});
