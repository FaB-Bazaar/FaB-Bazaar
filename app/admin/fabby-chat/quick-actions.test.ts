/**
 * Unit tests for the quick-action formatters — the zero-token deterministic
 * path in the Fabby chat, the binder drill-down lines, and the lazy context
 * hand-off to the next AI turn.
 */

import { describe, it, expect } from 'vitest';
import {
  summarizeBinders,
  summarizeWantsCards,
  summarizeDecks,
  summarizeBinderCards,
  buildMessageWithContext,
} from './quick-actions';

describe('summarizeBinders', () => {
  it('produces drillable lines carrying binder id and name', () => {
    const result = summarizeBinders([
      { _id: 'b1', name: 'Pirate', slug: 'pirate' },
      { _id: 'b2', name: 'No Slug Binder', slug: null },
    ]);
    expect(result.title).toBe('Your binders (2)');
    expect(result.lines[0]).toEqual({ text: 'Pirate (pirate)', drill: { binderId: 'b1', name: 'Pirate' } });
    expect(result.lines[1]).toEqual({ text: 'No Slug Binder', drill: { binderId: 'b2', name: 'No Slug Binder' } });
    expect(result.context).toContain('Pirate [pirate]');
  });

  it('handles the empty state', () => {
    const result = summarizeBinders([]);
    expect(result.lines).toEqual(['No binders yet.']);
    expect(result.context).toContain('none');
  });
});

describe('summarizeWantsCards', () => {
  it('formats the legacy wants cards shape defensively', () => {
    const result = summarizeWantsCards([
      { display_name: 'Vigorous Smashup (Red)', quantity: 2, priority: 'high' },
      { name: 'Pummel' }, // missing quantity/priority must not crash
    ]);
    expect(result.lines[0]).toBe('2× Vigorous Smashup (Red) (high)');
    expect(result.lines[1]).toBe('1× Pummel');
    expect(result.title).toBe('Your wants (2)');
  });

  it('handles the empty state', () => {
    expect(summarizeWantsCards([]).lines).toEqual(['Your wants list is empty.']);
  });
});

describe('summarizeDecks', () => {
  it('formats hero and format when present', () => {
    const result = summarizeDecks([
      { name: 'CC Gravy', format: 'cc', heroDisplayName: 'Gravy Bones' },
      { name: 'Untitled' },
    ]);
    expect(result.lines).toEqual(['CC Gravy — Gravy Bones (cc)', 'Untitled']);
  });
});

describe('summarizeBinderCards', () => {
  it('formats contents with for-trade markers and a total line', () => {
    const result = summarizeBinderCards('Pirate', [
      { display_name: 'Gravy Bones, Shipwrecked Looter', quantity: 1 },
      { name: 'Salt the Wound', quantity: 3, forTrade: true },
    ], 56);
    expect(result.title).toBe('Binder: Pirate');
    expect(result.lines[0]).toBe('1× Gravy Bones, Shipwrecked Looter');
    expect(result.lines[1]).toBe('3× Salt the Wound · for trade');
    expect(result.lines[2]).toBe('Total: 56 cards');
    expect(result.context).toContain('"Pirate"');
    expect(result.context).toContain('[for trade]');
  });

  it('handles an empty binder', () => {
    expect(summarizeBinderCards('Empty', [], 0).lines).toEqual(['This binder is empty.']);
  });
});

describe('buildMessageWithContext', () => {
  it('passes the message through when nothing is queued', () => {
    expect(buildMessageWithContext([], 'hello')).toBe('hello');
  });

  it('prepends queued context blocks before the user text', () => {
    const message = buildMessageWithContext(
      ["The user's binders (name, slug): Pirate [pirate]"],
      'which of these is worth the most?',
    );
    expect(message).toContain('[Context');
    expect(message).toContain('Pirate [pirate]');
    expect(message.endsWith('which of these is worth the most?')).toBe(true);
  });
});
