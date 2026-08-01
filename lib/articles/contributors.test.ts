/**
 * Unit tests for the article-contributors normalize helper.
 *
 * Contributors are the co-author credits on an article (deck creator,
 * strategy inventor, guest writer). Stored as JSONB on articles; this
 * helper is the single validation/normalization gate used by the service
 * layer before any write.
 */

import { describe, it, expect } from 'vitest';
import { normalizeContributors, contributorsToMetadataAuthors } from './contributors';

describe('normalizeContributors', () => {
  it('accepts a valid contributor list and trims fields', () => {
    const result = normalizeContributors([
      { role: '  Deck by ', name: '  John Smith ', link: ' https://twitter.com/johnsmith ' },
      { name: 'mistercakes' },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contributors).toEqual([
      { role: 'Deck by', name: 'John Smith', link: 'https://twitter.com/johnsmith' },
      { name: 'mistercakes' },
    ]);
  });

  it('accepts an empty array (clears contributors)', () => {
    const result = normalizeContributors([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contributors).toEqual([]);
  });

  it('rejects a non-array value', () => {
    const result = normalizeContributors({ name: 'John' });
    expect(result.ok).toBe(false);
  });

  it('rejects an entry with a missing or empty name', () => {
    expect(normalizeContributors([{ role: 'Deck by' }]).ok).toBe(false);
    expect(normalizeContributors([{ name: '   ' }]).ok).toBe(false);
    expect(normalizeContributors(['John']).ok).toBe(false);
  });

  it('rejects a link that is not http(s) or an internal path', () => {
    expect(normalizeContributors([{ name: 'J', link: 'javascript:alert(1)' }]).ok).toBe(false);
    expect(normalizeContributors([{ name: 'J', link: 'ftp://x' }]).ok).toBe(false);
    // Internal profile links are allowed
    expect(normalizeContributors([{ name: 'J', link: '/profile/j' }]).ok).toBe(true);
  });

  it('drops unknown keys from entries', () => {
    const result = normalizeContributors([{ name: 'J', evil: '<script>' } as any]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contributors[0]).toEqual({ name: 'J' });
  });

  it('rejects more than 10 contributors', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `Person ${i}` }));
    expect(normalizeContributors(many).ok).toBe(false);
  });
});

describe('contributorsToMetadataAuthors', () => {
  it('maps contributors to Next metadata authors, keeping only absolute links as url', () => {
    expect(
      contributorsToMetadataAuthors([
        { role: 'Deck by', name: 'John Smith', link: 'https://twitter.com/johnsmith' },
        { name: 'Internal', link: '/profile/internal' },
        { name: 'NoLink' },
      ])
    ).toEqual([
      { name: 'John Smith', url: 'https://twitter.com/johnsmith' },
      { name: 'Internal' },
      { name: 'NoLink' },
    ]);
  });

  it('returns an empty array for undefined input', () => {
    expect(contributorsToMetadataAuthors(undefined)).toEqual([]);
  });
});
