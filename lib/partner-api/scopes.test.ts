import { describe, it, expect } from 'vitest';
import { PARTNER_SCOPES, parseScopes, hasScope } from './scopes';

describe('partner API scopes', () => {
  it('lists the scopes a partner can ask for', () => {
    expect([...PARTNER_SCOPES].sort()).toEqual([
      'cards:read',
      'collection:read',
      'collection:write',
      'decks:read',
      'decks:write',
    ]);
  });

  it('parses a space-separated scope string, dropping unknown scopes', () => {
    expect(parseScopes('collection:read  decks:write nonsense')).toEqual(
      new Set(['collection:read', 'decks:write']),
    );
  });

  it('treats a missing scope claim as no scopes', () => {
    expect(parseScopes(undefined)).toEqual(new Set());
    expect(parseScopes('')).toEqual(new Set());
  });

  it('does not let the legacy "read write" scopes stand in for partner scopes', () => {
    const granted = parseScopes('read write claudeai');
    expect(hasScope(granted, 'collection:read')).toBe(false);
    expect(hasScope(granted, 'decks:write')).toBe(false);
  });

  it('lets a write scope satisfy the matching read scope', () => {
    const granted = parseScopes('collection:write');
    expect(hasScope(granted, 'collection:read')).toBe(true);
    expect(hasScope(granted, 'decks:read')).toBe(false);
  });

  it('requires the exact resource', () => {
    const granted = parseScopes('decks:read');
    expect(hasScope(granted, 'decks:read')).toBe(true);
    expect(hasScope(granted, 'decks:write')).toBe(false);
    expect(hasScope(granted, 'cards:read')).toBe(false);
  });
});
