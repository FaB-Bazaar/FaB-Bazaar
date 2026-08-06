import { describe, it, expect } from 'vitest';
import { parseInstantActionParam, volzarInstantHref, INSTANT_LINK_ACTIONS } from './instant-link';

describe('parseInstantActionParam', () => {
  it('parses each supported action id from a query string', () => {
    for (const action of INSTANT_LINK_ACTIONS) {
      expect(parseInstantActionParam(`?action=${action}`)).toBe(action);
    }
  });

  it('includes the daily movers action (⚡ sheet deep link)', () => {
    expect(parseInstantActionParam('?action=daily')).toBe('daily');
  });

  it('parses when other params are present', () => {
    expect(parseInstantActionParam('?foo=1&action=binders&bar=2')).toBe('binders');
  });

  it('returns null for unknown actions (never auto-runs arbitrary strings)', () => {
    expect(parseInstantActionParam('?action=delete-everything')).toBeNull();
    expect(parseInstantActionParam('?action=')).toBeNull();
  });

  it('returns null when the param is absent', () => {
    expect(parseInstantActionParam('')).toBeNull();
    expect(parseInstantActionParam('?from=opt&q=x')).toBeNull();
  });
});

describe('volzarInstantHref', () => {
  it('builds the /volzar deep link that parseInstantActionParam round-trips', () => {
    const href = volzarInstantHref('wants');
    expect(href).toBe('/volzar?action=wants');
    expect(parseInstantActionParam(new URL(href, 'https://x').search)).toBe('wants');
  });
});
