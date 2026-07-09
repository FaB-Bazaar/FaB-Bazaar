/**
 * parseCoverageLines: turns the compare_collection_to_decks_to_beat tool's
 * structuredContent into clickable data-card lines — each deck drills into
 * the existing You-vs-deck comparison (the missing-cards delta).
 */

import { describe, it, expect } from 'vitest';
import { parseCoverageLines } from './quick-actions';

const STRUCTURED = {
  coverageDecks: [
    {
      publicId: 'd2', deckName: 'Kano Combo', heroName: 'Kano', format: 'Classic Constructed',
      totalNeeded: 81, totalOwned: 73, coveragePct: 90, missingCards: 3, missingCost: 12.5,
      topMissing: [], eventName: 'The Calling', placing: 2,
    },
    {
      publicId: 'd3', deckName: 'Built Already', heroName: 'Bravo', format: 'Classic Constructed',
      totalNeeded: 80, totalOwned: 80, coveragePct: 100, missingCards: 0, missingCost: 0,
      topMissing: [],
    },
  ],
};

describe('parseCoverageLines', () => {
  it('returns undefined for non-coverage payloads', () => {
    expect(parseCoverageLines(undefined)).toBeUndefined();
    expect(parseCoverageLines({})).toBeUndefined();
    expect(parseCoverageLines({ coverageDecks: [] })).toBeUndefined();
    expect(parseCoverageLines({ cards: [] })).toBeUndefined();
  });

  it('maps each deck to a line that drills into the deck-compare view', () => {
    const lines = parseCoverageLines(STRUCTURED)!;
    expect(lines).toHaveLength(2);

    const first = lines[0] as Exclude<(typeof lines)[0], string>;
    expect(first.text).toContain('90%');
    expect(first.text).toContain('73/81');
    expect(first.text).toContain('Kano Combo');
    expect(first.text).toContain('3 missing');
    expect(first.text).toContain('$12.50');
    expect(first.drill).toEqual({ kind: 'deck-compare', id: 'd2', name: 'Kano Combo' });
  });

  it('marks fully-buildable decks complete instead of quoting a $0 cost', () => {
    const lines = parseCoverageLines(STRUCTURED)!;
    const full = lines[1] as Exclude<(typeof lines)[0], string>;
    expect(full.text).toContain('100%');
    expect(full.text).toMatch(/complete/i);
    expect(full.text).not.toContain('$');
    expect(full.drill).toEqual({ kind: 'deck-compare', id: 'd3', name: 'Built Already' });
  });

  it('skips malformed rows', () => {
    const lines = parseCoverageLines({ coverageDecks: [{ deckName: 'No id' }, STRUCTURED.coverageDecks[0]] })!;
    expect(lines).toHaveLength(1);
  });
});
