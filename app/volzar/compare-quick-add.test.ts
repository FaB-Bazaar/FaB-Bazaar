/**
 * Per-row quick-add on the You-vs-deck comparison: Missing/Partial rows carry
 * the shortage (addQty) and one-click runners add that many copies to wants /
 * a binder — so "I actually own this" is fixable on the row itself, without
 * mousing down to the preview footer (which hover-previews every card en route).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client', () => ({
  bindersClient: { addCardsToBinder: vi.fn() },
  wantsClient: { addWantsItem: vi.fn() },
  decksClient: { getInventoryComparison: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { runDeckCompareDrill, addCompareRowToWants, addCompareRowToBinder, type CardRow } from './quick-actions';
import { bindersClient, decksClient, wantsClient } from '@/lib/client';

const mockComparison = vi.mocked(decksClient.getInventoryComparison);
const mockAddWants = vi.mocked(wantsClient.addWantsItem);
const mockAddToBinder = vi.mocked(bindersClient.addCardsToBinder);

const COMPARISON = {
  owned: [{ printingId: 'p-own', cardName: 'Owned Card', needed: 3, owned: 3, conditions: [], binderNames: [] }],
  missing: [{ printingId: 'p-miss', cardName: 'Missing Card', needed: 3, tcgLow: 0.2 }],
  partial: [{ printingId: 'p-part', cardName: 'Partial Card', needed: 3, owned: 1, shortage: 2, tcgLow: 1 }],
  summary: { totalNeeded: 9, totalOwned: 4, totalMissing: 5, completionPercentage: 44, estimatedMissingValue: 2.6 },
};

const row = (over: Partial<Exclude<CardRow, string>> = {}): CardRow => ({
  name: 'Missing Card',
  addQty: 3,
  preview: { imageUrl: '', name: 'Missing Card', printingId: 'p-miss' },
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('runDeckCompareDrill quick-add plumbing', () => {
  it('missing/partial rows carry addQty (the shortage) and the result carries a compareRefresh handle', async () => {
    mockComparison.mockResolvedValue({ success: true, data: COMPARISON } as any);
    const result = await runDeckCompareDrill('deck-1', 'Gravy Bones');

    const missingRows = result.tableSections!.find((s) => s.title.startsWith('Missing'))!.rows;
    const partialRows = result.tableSections!.find((s) => s.title === 'Partial')!.rows;
    expect((missingRows[0] as any).addQty).toBe(3);   // owns 0 of 3
    expect((partialRows[0] as any).addQty).toBe(2);   // owns 1 of 3

    expect(result.compareRefresh).toEqual({ publicId: 'deck-1', deckName: 'Gravy Bones' });
  });
});

describe('addCompareRowToWants', () => {
  it('adds the shortage quantity for the row printing', async () => {
    mockAddWants.mockResolvedValue({ success: true } as any);
    const outcome = await addCompareRowToWants(row());
    expect(outcome.ok).toBe(true);
    expect(mockAddWants).toHaveBeenCalledWith('p-miss', 3);
  });

  it('fails cleanly when the row has nothing to add', async () => {
    const outcome = await addCompareRowToWants(row({ addQty: undefined }));
    expect(outcome.ok).toBe(false);
    expect(mockAddWants).not.toHaveBeenCalled();
  });

  it('propagates service errors', async () => {
    mockAddWants.mockResolvedValue({ success: false, error: 'nope' } as any);
    const outcome = await addCompareRowToWants(row());
    expect(outcome).toEqual({ ok: false, error: 'nope' });
  });
});

describe('addCompareRowToBinder', () => {
  it('adds the shortage quantity to the target binder, NOT flagged for trade', async () => {
    mockAddToBinder.mockResolvedValue({ success: true, data: { results: [{ action: 'added' }] } } as any);
    const outcome = await addCompareRowToBinder('binder-9', row());
    expect(outcome.ok).toBe(true);
    // forTrade false: quick-add records cards the user owns and intends to
    // PLAY in this deck — advertising them for trade must be an explicit act.
    expect(mockAddToBinder).toHaveBeenCalledWith('binder-9', [
      { printingId: 'p-miss', quantity: 3, forTrade: false },
    ]);
  });

  it('propagates service errors', async () => {
    mockAddToBinder.mockResolvedValue({ success: false, error: 'binder gone' } as any);
    const outcome = await addCompareRowToBinder('binder-9', row());
    expect(outcome).toEqual({ ok: false, error: 'binder gone' });
  });
});
