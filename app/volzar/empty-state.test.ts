import { describe, it, expect } from 'vitest';
import { hasPreviewableContent } from './empty-state';

const dataItem = (extra: Record<string, unknown> = {}) =>
  ({ kind: 'data', title: 'x', lines: [], ...extra });

describe('hasPreviewableContent', () => {
  it('is false for an empty conversation', () => {
    expect(hasPreviewableContent([], 0)).toBe(false);
  });

  it('is false for plain text turns (nothing to hover)', () => {
    const items = [
      { kind: 'user', text: 'hi' },
      { kind: 'assistant', text: 'hello there' },
    ];
    expect(hasPreviewableContent(items, 0)).toBe(false);
  });

  it('is true once a data item carries table rows', () => {
    expect(hasPreviewableContent([dataItem({ tableRows: [{ name: 'Fyendal' }] })], 0)).toBe(true);
  });

  it('is true once a data item carries table sections with rows', () => {
    const items = [dataItem({ tableSections: [{ title: 'Inventory', count: 1, rows: [{ name: 'x' }] }] })];
    expect(hasPreviewableContent(items, 0)).toBe(true);
  });

  it('ignores empty tables and empty sections', () => {
    const items = [
      dataItem({ tableRows: [] }),
      dataItem({ tableSections: [{ title: 'Inventory', count: 0, rows: [] }] }),
    ];
    expect(hasPreviewableContent(items, 0)).toBe(false);
  });

  it('is true when a data item has hoverable lines (line carries a preview)', () => {
    const items = [dataItem({ lines: [{ text: 'Snatch (red)', preview: { name: 'Snatch' } }] })];
    expect(hasPreviewableContent(items, 0)).toBe(true);
  });

  it('is false for listing lines without previews (binder picker rows)', () => {
    const items = [dataItem({ lines: [{ text: 'Trade binder — 120 cards' }] })];
    expect(hasPreviewableContent(items, 0)).toBe(false);
  });

  it('tolerates plain-string lines (CardLine is string | object)', () => {
    const items = [dataItem({ lines: ['Query: "ninja"', '42 results'] })];
    expect(hasPreviewableContent(items, 0)).toBe(false);
  });

  it('is true when the AI reply harvested hoverable card names', () => {
    const items = [{ kind: 'assistant', text: 'Try Command and Conquer.' }];
    expect(hasPreviewableContent(items, 3)).toBe(true);
  });

  it('is true when a data item carries a deck card view', () => {
    expect(hasPreviewableContent([dataItem({ cards: [{ name: 'Edge of Autumn' }] })], 0)).toBe(true);
  });
});
