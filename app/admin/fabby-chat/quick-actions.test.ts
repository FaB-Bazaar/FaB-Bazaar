/**
 * Unit tests for the quick-action formatters — the zero-token deterministic
 * path in the Fabby chat, and the lazy context hand-off to the next AI turn.
 */

import { describe, it, expect } from 'vitest';
import {
  summarizeBinders,
  summarizeWants,
  summarizeDecks,
  buildMessageWithContext,
} from './quick-actions';

describe('summarizeBinders', () => {
  it('formats names with slugs and counts', () => {
    const result = summarizeBinders([
      { name: 'Pirate', slug: 'pirate' },
      { name: 'No Slug Binder', slug: null },
    ]);
    expect(result.title).toBe('Your binders (2)');
    expect(result.lines).toEqual(['Pirate (pirate)', 'No Slug Binder']);
    expect(result.context).toContain('Pirate [pirate]');
  });

  it('handles the empty state', () => {
    const result = summarizeBinders([]);
    expect(result.lines).toEqual(['No binders yet.']);
    expect(result.context).toContain('none');
  });
});

describe('summarizeWants', () => {
  it('formats quantity, name, priority, and truncation notice', () => {
    const result = summarizeWants({
      items: [
        { display_name: 'Vigorous Smashup (Red)', quantity: 2, priority: 'high' },
        { name: 'Pummel', quantity: 1, priority: 'low' },
      ],
      total: 10,
    });
    expect(result.lines[0]).toBe('2× Vigorous Smashup (Red) (high)');
    expect(result.lines[1]).toBe('1× Pummel (low)');
    expect(result.lines[2]).toBe('…and 8 more');
    expect(result.context).toContain('plus 8 more not shown');
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
