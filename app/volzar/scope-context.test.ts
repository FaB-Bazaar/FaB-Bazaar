// Pure scope/focus helpers for the dual-focus loop: the manual surface
// (workspace + filters) decides WHAT Volzar is asked about; these build the
// context that rides the next chat turn.

import { describe, it, expect } from 'vitest';
import {
  EMPTY_SCOPE_FILTER, isScopeFilterActive, narrowItem, scopeCardCounts,
  describeScopeFilter, buildScope, planFocusContext, EMPTY_FOCUS_LEDGER,
  type FocusLedger,
} from './scope-context';
import type { CardRow } from './quick-actions';

const row = (name: string, pitch: number | undefined, type: string, qty = 1): CardRow => ({
  name, pitch, type, qty, preview: { imageUrl: '', name, printingId: `p-${name}-${pitch ?? 0}` },
});

const deck = {
  title: 'Deck: Teklosaucen',
  context: 'FULL DECK CONTEXT',
  tableSections: [
    { title: 'Equipment', count: 1, rows: [row('Teklo Plasma Pistol', undefined, 'Mechanologist Weapon - Pistol (1H)')] },
    { title: 'Maindeck', count: 8, rows: [
      row('Zero to Sixty', 1, 'Mechanologist Action - Attack', 3),
      row('Zipper Hit', 3, 'Mechanologist Action - Attack', 3),
      row('Sink Below', 1, 'Generic Defense Reaction', 2),
    ] },
  ],
};

const binder = {
  title: 'Binder: Trades',
  context: 'FULL BINDER CONTEXT',
  tableRows: [
    row('Command and Conquer', 1, 'Generic Action - Attack', 2),
    row('Art of War', 2, 'Generic Instant'),
  ],
};

describe('scope filter', () => {
  it('is inactive when empty or whitespace-only', () => {
    expect(isScopeFilterActive(EMPTY_SCOPE_FILTER)).toBe(false);
    expect(isScopeFilterActive({ pitches: [], text: '   ' })).toBe(false);
    expect(isScopeFilterActive({ pitches: [1], text: '' })).toBe(true);
    expect(isScopeFilterActive({ pitches: [], text: 'attack' })).toBe(true);
  });

  it('returns the SAME item when the filter is inactive', () => {
    expect(narrowItem(deck, EMPTY_SCOPE_FILTER)).toBe(deck);
  });

  it('narrows sections by pitch, drops emptied sections and recounts by quantity', () => {
    const out = narrowItem(deck, { pitches: [1], text: '' });
    expect(out.tableSections).toHaveLength(1);
    expect(out.tableSections![0].title).toBe('Maindeck');
    expect(out.tableSections![0].rows.map((r) => r.name)).toEqual(['Zero to Sixty', 'Sink Below']);
    expect(out.tableSections![0].count).toBe(5);
  });

  it('keeps the original row objects (row handlers match by identity fields)', () => {
    const out = narrowItem(deck, { pitches: [3], text: '' });
    expect(out.tableSections![0].rows[0]).toBe(deck.tableSections[1].rows[1]);
  });

  it('matches text against name OR type line, case-insensitively, AND-ed with pitch', () => {
    expect(narrowItem(binder, { pitches: [], text: 'INSTANT' }).tableRows!.map((r) => r.name)).toEqual(['Art of War']);
    expect(narrowItem(binder, { pitches: [], text: 'command' }).tableRows!.map((r) => r.name)).toEqual(['Command and Conquer']);
    expect(narrowItem(binder, { pitches: [2], text: 'attack' }).tableRows).toEqual([]);
  });

  it('requires every word of a multi-word filter (any order)', () => {
    const out = narrowItem(deck, { pitches: [], text: 'attack mech' });
    expect(out.tableSections![0].rows.map((r) => r.name)).toEqual(['Zero to Sixty', 'Zipper Hit']);
  });

  it('counts shown vs total cards by quantity', () => {
    expect(scopeCardCounts(deck, { pitches: [1], text: '' })).toEqual({ shown: 5, total: 9 });
    expect(scopeCardCounts(binder, EMPTY_SCOPE_FILTER)).toEqual({ shown: 3, total: 3 });
  });

  it('has no counts for items without card rows (listings)', () => {
    expect(scopeCardCounts({ title: 'My decks', context: 'x' }, EMPTY_SCOPE_FILTER)).toBeNull();
  });

  it('describes the filter in words', () => {
    expect(describeScopeFilter({ pitches: [3, 1], text: ' attack ' })).toBe('red or blue pitch, matching "attack"');
    expect(describeScopeFilter({ pitches: [2], text: '' })).toBe('yellow pitch');
  });
});

describe('buildScope', () => {
  it('unfiltered: the item\'s own full context, keyed by title', () => {
    expect(buildScope(deck, EMPTY_SCOPE_FILTER)).toEqual({
      key: 'Deck: Teklosaucen', title: 'Deck: Teklosaucen', context: 'FULL DECK CONTEXT', narrowed: false,
    });
  });

  it('is null when the item carries no context', () => {
    expect(buildScope({ title: 'Added to binder' }, EMPTY_SCOPE_FILTER)).toBeNull();
  });

  it('narrowed: a self-describing subset listing ONLY the matching cards', () => {
    const scope = buildScope(deck, { pitches: [1], text: '' })!;
    expect(scope.narrowed).toBe(true);
    expect(scope.key).not.toBe('Deck: Teklosaucen');
    expect(scope.context).toContain('"Deck: Teklosaucen"');
    expect(scope.context).toContain('red pitch');
    expect(scope.context).toContain('5 of 9 cards');
    expect(scope.context).toContain('Maindeck: 3× Zero to Sixty (p1, Mechanologist Action - Attack); 2× Sink Below (p1, Generic Defense Reaction)');
    expect(scope.context).not.toContain('Zipper Hit');
    expect(scope.context).not.toContain('FULL DECK CONTEXT');
  });

  it('narrowed flat lists (binders) keep the for-trade marker', () => {
    const b = { ...binder, tableRows: [{ ...binder.tableRows[0], forTrade: true }, binder.tableRows[1]] };
    const scope = buildScope(b, { pitches: [1], text: '' })!;
    expect(scope.context).toContain('2× Command and Conquer (p1, Generic Action - Attack) [for trade]');
  });

  it('narrowed to nothing says so instead of sending an empty list', () => {
    const scope = buildScope(binder, { pitches: [3], text: '' })!;
    expect(scope.context).toContain('0 of 3 cards');
    expect(scope.context).toContain('no cards match');
  });

  it('a filter on an item without card rows falls back to the full context', () => {
    const scope = buildScope({ title: 'My decks', context: 'LISTING' }, { pitches: [1], text: '' })!;
    expect(scope).toMatchObject({ context: 'LISTING', narrowed: false });
  });
});

describe('planFocusContext', () => {
  const full = buildScope(deck, EMPTY_SCOPE_FILTER)!;

  it('no focus → nothing attached', () => {
    const { lines, ledger } = planFocusContext(null, EMPTY_FOCUS_LEDGER);
    expect(lines).toEqual([]);
    expect(ledger.lastFocusKey).toBeNull();
  });

  it('first time → the full context under a focus header', () => {
    const { lines, ledger } = planFocusContext(full, EMPTY_FOCUS_LEDGER);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"Deck: Teklosaucen"');
    expect(lines[1]).toBe('FULL DECK CONTEXT');
    expect(ledger.sent[full.key]).toBe('FULL DECK CONTEXT');
    expect(ledger.lastFocusKey).toBe(full.key);
  });

  it('unchanged and still the focus → zero tokens', () => {
    const first = planFocusContext(full, EMPTY_FOCUS_LEDGER);
    const second = planFocusContext(full, first.ledger);
    expect(second.lines).toEqual([]);
  });

  it('edited since it was sent → re-sent, marked as replacing the earlier version', () => {
    const first = planFocusContext(full, EMPTY_FOCUS_LEDGER);
    const edited = { ...full, context: 'EDITED DECK CONTEXT' };
    const second = planFocusContext(edited, first.ledger);
    expect(second.lines[0]).toMatch(/replaces/i);
    expect(second.lines[1]).toBe('EDITED DECK CONTEXT');
    expect(second.ledger.sent[full.key]).toBe('EDITED DECK CONTEXT');
  });

  it('coming BACK to something already sent → a one-line pointer, not the list again', () => {
    const other = buildScope(binder, EMPTY_SCOPE_FILTER)!;
    let ledger: FocusLedger = planFocusContext(full, EMPTY_FOCUS_LEDGER).ledger;
    ledger = planFocusContext(other, ledger).ledger;
    const back = planFocusContext(full, ledger);
    expect(back.lines).toHaveLength(1);
    expect(back.lines[0]).toContain('"Deck: Teklosaucen"');
    expect(back.lines[0]).toMatch(/unchanged/i);
    expect(back.lines[0]).not.toContain('FULL DECK CONTEXT');
  });

  it('a turn with no focus forgets the last focus, so returning re-points', () => {
    let ledger = planFocusContext(full, EMPTY_FOCUS_LEDGER).ledger;
    ledger = planFocusContext(null, ledger).ledger;
    expect(planFocusContext(full, ledger).lines).toHaveLength(1);
  });

  it('a narrowed subset is sent without the "replaces" wording, and the full list stays remembered', () => {
    const first = planFocusContext(full, EMPTY_FOCUS_LEDGER);
    const narrowed = buildScope(deck, { pitches: [1], text: '' })!;
    const second = planFocusContext(narrowed, first.ledger);
    expect(second.lines.join('\n')).not.toMatch(/replaces/i);
    expect(second.lines.join('\n')).toContain('Zero to Sixty');
    // Clearing the filter returns to the full list: pointer only.
    const third = planFocusContext(full, second.ledger);
    expect(third.lines).toHaveLength(1);
    expect(third.lines[0]).toMatch(/unchanged/i);
  });

  it('does not mutate the ledger it was given', () => {
    planFocusContext(full, EMPTY_FOCUS_LEDGER);
    expect(EMPTY_FOCUS_LEDGER).toEqual({ sent: {}, lastFocusKey: null });
  });
});
