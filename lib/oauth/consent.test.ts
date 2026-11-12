import { describe, it, expect } from 'vitest';
import { classifyScopeRequest, isCoveredBy, consentLines } from './consent';

describe('classifyScopeRequest', () => {
  it('treats a request made only of partner scopes as a limited grant', () => {
    expect(classifyScopeRequest('decks:read  collection:write')).toEqual({
      kind: 'partner',
      scopes: ['collection:write', 'decks:read'],
      scope: 'collection:write decks:read',
    });
  });

  it('treats the legacy scopes as full account access, keeping the string as sent', () => {
    expect(classifyScopeRequest('read write')).toEqual({ kind: 'full', scope: 'read write' });
    expect(classifyScopeRequest('claudeai')).toEqual({ kind: 'full', scope: 'claudeai' });
  });

  it('defaults a missing scope to the legacy full-access grant', () => {
    expect(classifyScopeRequest(null)).toEqual({ kind: 'full', scope: 'read write' });
    expect(classifyScopeRequest('   ')).toEqual({ kind: 'full', scope: 'read write' });
  });

  it('never narrows a request that mixes in anything else: it is full access, and says so', () => {
    // A token carrying a non-partner scope works on the whole account, so the
    // user must be shown "full access" rather than the partner lines.
    expect(classifyScopeRequest('collection:read write')).toEqual({ kind: 'full', scope: 'collection:read write' });
    expect(classifyScopeRequest('collection:read made-up')).toEqual({
      kind: 'full',
      scope: 'collection:read made-up',
    });
  });
});

describe('isCoveredBy', () => {
  const partner = (scope: string) => classifyScopeRequest(scope);

  it('is covered when an earlier grant already includes every requested scope', () => {
    expect(isCoveredBy(partner('decks:read'), ['decks:read collection:read'])).toBe(true);
  });

  it('lets an earlier write grant cover a read request', () => {
    expect(isCoveredBy(partner('collection:read'), ['collection:write'])).toBe(true);
  });

  it('is not covered when the request asks for more than was granted', () => {
    expect(isCoveredBy(partner('collection:write'), ['collection:read'])).toBe(false);
    expect(isCoveredBy(partner('decks:read collection:read'), ['decks:read'])).toBe(false);
    expect(isCoveredBy(partner('decks:read'), [])).toBe(false);
  });

  it('does not add scopes up across separate grants', () => {
    expect(isCoveredBy(partner('decks:read collection:read'), ['decks:read', 'collection:read'])).toBe(false);
  });

  it('covers a full-access request only with an earlier full-access grant', () => {
    expect(isCoveredBy(partner('read write'), ['read write'])).toBe(true);
    expect(isCoveredBy(partner('read write'), ['claudeai'])).toBe(true);
    expect(isCoveredBy(partner('read write'), ['collection:write decks:write cards:read'])).toBe(false);
  });

  it('lets an earlier full-access grant cover a limited request', () => {
    expect(isCoveredBy(partner('decks:read'), ['read write'])).toBe(true);
  });
});

describe('consentLines', () => {
  it('spells out full access', () => {
    const lines = consentLines(classifyScopeRequest('read write'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/full access/i);
  });

  it('says plainly that deck write access includes adding and removing cards', () => {
    expect(consentLines(classifyScopeRequest('decks:write'))).toEqual([
      'See your decks, create new ones, and add or remove cards in them',
    ]);
  });

  it('gives one plain line per area, folding read into write', () => {
    expect(consentLines(classifyScopeRequest('collection:read collection:write decks:read cards:read'))).toEqual([
      'Search the card catalog',
      'See your binders, and add, change and remove cards in them',
      'See your decks',
    ]);
  });
});
