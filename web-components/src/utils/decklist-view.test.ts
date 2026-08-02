import { describe, it, expect } from 'vitest';
import { resolveDecklistViewMode } from './decklist-view';

describe('resolveDecklistViewMode', () => {
  it('honors a saved grid preference even on narrow viewports', () => {
    expect(resolveDecklistViewMode('grid', true)).toBe('grid');
  });

  it('honors a saved list preference on wide viewports', () => {
    expect(resolveDecklistViewMode('list', false)).toBe('list');
  });

  it('defaults to list on narrow viewports when nothing is saved', () => {
    expect(resolveDecklistViewMode(null, true)).toBe('list');
  });

  it('defaults to grid on wide viewports when nothing is saved', () => {
    expect(resolveDecklistViewMode(null, false)).toBe('grid');
  });

  it('ignores garbage saved values and falls back to the viewport default', () => {
    expect(resolveDecklistViewMode('banana', true)).toBe('list');
    expect(resolveDecklistViewMode('banana', false)).toBe('grid');
  });
});
