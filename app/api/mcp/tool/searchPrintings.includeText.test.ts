/**
 * Deckbuilding searches (heroLegal / format) return card text by default so an
 * agent reads what a card does instead of guessing from its name. An explicit
 * includeText still wins either way.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn() },
}));

import { resolveIncludeText, searchPrintingsTool } from './searchPrintings';

describe('resolveIncludeText', () => {
  it('is on for a heroLegal search', () => {
    expect(resolveIncludeText({}, [{ filters: { heroLegal: 'dorinthea ironsong' } }])).toBe(true);
  });

  it('is on for a format search', () => {
    expect(resolveIncludeText({}, [{ filters: { format: 'blitz' } }])).toBe(true);
  });

  it('is on when any one descriptor is a deckbuilding search', () => {
    expect(resolveIncludeText({}, [{ query: 'Pummel' }, { filters: { format: 'cc' } }])).toBe(true);
  });

  it('stays off for a plain name or collection search', () => {
    expect(resolveIncludeText({}, [{ query: 'Pummel' }, { filters: { name: 'Snatch' } }])).toBe(false);
  });

  it('respects an explicit false on a deckbuilding search', () => {
    expect(resolveIncludeText({ includeText: false }, [{ filters: { heroLegal: 'dorinthea' } }])).toBe(false);
  });

  it('respects an explicit true on a plain search', () => {
    expect(resolveIncludeText({ includeText: true }, [{ query: 'Pummel' }])).toBe(true);
  });
});

describe('search_printings includeText schema', () => {
  it('documents the deckbuilding default', () => {
    const desc = JSON.stringify(searchPrintingsTool);
    expect(desc).toMatch(/Default: on when a card filters by heroLegal or format/);
  });
});
