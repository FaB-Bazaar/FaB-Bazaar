import { describe, it, expect } from 'vitest';
import { binderImportSummary } from './binder-import-summary';

const ok = (quantityAdded: number, action: 'added' | 'updated' = 'added') => ({ printingId: 'p', success: true, action, quantityAdded });

describe('binderImportSummary', () => {
  it('counts copies, not rows: 10 cards over 7 printings is "10 cards"', () => {
    const results = [ok(3), ok(2), ok(1), ok(1), ok(1), ok(1, 'updated'), ok(1)];
    expect(binderImportSummary({ summary: { failed: 0 }, results })).toBe('10 cards added.');
  });

  it('says "card" for one copy', () => {
    expect(binderImportSummary({ summary: { failed: 0 }, results: [ok(1)] })).toBe('1 card added.');
  });

  it('reports failed rows', () => {
    const results = [ok(2), { printingId: 'x', success: false, error: 'nope' }];
    expect(binderImportSummary({ summary: { failed: 1 }, results })).toBe("2 cards added. 1 couldn't be added.");
  });

  it('treats a missing quantityAdded as one copy', () => {
    expect(binderImportSummary({ summary: { failed: 0 }, results: [{ success: true }] })).toBe('1 card added.');
  });
});
