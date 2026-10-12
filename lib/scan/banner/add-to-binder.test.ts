import { describe, it, expect } from 'vitest';
import { pickDefaultBinder, addableRowIds, addedFromResult } from './add-to-binder';

// /scan adds each card straight to a binder (no stage): one default binder at the top, remembered between visits.
const binders = [{ _id: 'b1', name: 'Main', slug: 'main' }, { _id: 'b2', name: 'Trade Binder', slug: 'trade' }];

describe('pickDefaultBinder', () => {
  it('the binder used last time, when it still exists', () => {
    expect(pickDefaultBinder(binders, 'b2')?._id).toBe('b2');
  });
  it('the first binder when nothing is remembered, or the remembered one was deleted', () => {
    expect(pickDefaultBinder(binders, null)?._id).toBe('b1');
    expect(pickDefaultBinder(binders, 'gone')?._id).toBe('b1');
  });
  it('none when the user has no binders yet', () => {
    expect(pickDefaultBinder([], 'b2')).toBeNull();
  });
});

describe('addableRowIds', () => {
  const row = (o: Record<string, unknown>) => ({ id: 'x', name: 'Massacre', status: 'ok', printing: { printing_id: 'p' }, ...o }) as any;
  it('"Add all" takes the rows that are sure, matched and not added yet', () => {
    const rows = [
      row({ id: 'ok' }),
      row({ id: 'unsure', status: 'check' }),                     // the user confirms the card first
      row({ id: 'loading', printing: null }),                     // printing still loading / no match
      row({ id: 'unnamed', name: '' }),                           // a tap we couldn't read
      row({ id: 'done', added: { binderId: 'b1' } }),
      row({ id: 'busy', adding: true }),
    ];
    expect(addableRowIds(rows)).toEqual(['ok']);
  });
});

describe('addedFromResult', () => {
  it('records the binder and the inventory item the copy landed in (what Undo takes back)', () => {
    const res = { summary: { failed: 0 }, results: [{ printingId: 'p', success: true, quantityAdded: 1, inventoryItemId: 'inv1' }] };
    expect(addedFromResult(res, binders[1])).toEqual({ ok: true, added: { binderId: 'b2', binderName: 'Trade Binder', inventoryItemId: 'inv1', quantity: 1 } });
  });
  it('a failed add reports why, and nothing is recorded', () => {
    const res = { summary: { failed: 1 }, results: [{ printingId: 'p', success: false, error: 'Printing not found in database: p' }] };
    expect(addedFromResult(res, binders[0])).toEqual({ ok: false, error: 'Printing not found in database: p' });
  });
});
