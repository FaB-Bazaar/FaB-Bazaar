/**
 * Deck card mutations shared by the rail deck page and the classic page.
 *
 * The bulk add route answers 200 with per-row outcomes, so a copy-cap or
 * legality rejection is NOT an envelope failure. A move is remove-then-add:
 * if the add is rejected the copies must go back where they came from, or the
 * cards silently leave the deck.
 */
import { describe, it, expect, vi } from 'vitest';
import { addCopies, moveCopies, removeCopies, withQuantity, type DeckMutationClient } from './deck-mutations';

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
