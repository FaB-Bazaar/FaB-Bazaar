/**
 * optQueryToSearchRequest must rebuild EXACTLY the POST body the /opt page
 * sends for a URL — the search cache is keyed by a hash of that body, so a
 * warm-up request that differs by one field warms a key no visitor ever reads.
 * The fixtures are bodies captured from the live /opt page (2026-09-26).
 */
import { describe, it, expect } from 'vitest';
import { optQueryToSearchRequest, buildSearchRequest } from './opt-search-request';
import { expandSetSelections } from '@/lib/fab-constants/sets';

const CAPTURED: Record<string, string> = {
  'talents=draconic&sortBy=rarity':
    '{"filters":{"talents":["draconic"],"classTalentUnion":true,"languages":["en"]},"options":{"page":1,"limit":60,"sortBy":"rarity","sortOrder":"asc","searchMode":"strict","groupByCard":true}}',
  'classes=generic':
    '{"filters":{"classes":["generic"],"genericTalentless":true,"classTalentUnion":true,"languages":["en"]},"options":{"page":1,"limit":60,"sortBy":"name","sortOrder":"asc","searchMode":"strict","groupByCard":true}}',
  'sets=gem&pack=24720&sortBy=set':
    '{"filters":{"sets":["gem"],"tcgGroupIds":[24720],"languages":["en"]},"options":{"page":1,"limit":60,"sortBy":"set","sortOrder":"asc","searchMode":"strict","groupByCard":true}}',
  'classes=ninja&talents=draconic':
    '{"filters":{"classes":["ninja"],"talents":["draconic"],"classTalentUnion":true,"languages":["en"]},"options":{"page":1,"limit":60,"sortBy":"name","sortOrder":"asc","searchMode":"strict","groupByCard":true}}',
};

describe('optQueryToSearchRequest', () => {
  it.each(Object.entries(CAPTURED))('%s matches the body the /opt page sent', (query, body) => {
    expect(optQueryToSearchRequest(query)).toEqual(JSON.parse(body));
  });

  it('expands a grp: set token the way the page does (encoded or not)', () => {
    const expected = {
      filters: { sets: expandSetSelections(['grp:armory']), languages: ['en'] },
      options: { page: 1, limit: 60, sortBy: 'name', sortOrder: 'asc', searchMode: 'strict', groupByCard: true },
    };
    expect(optQueryToSearchRequest('sets=grp%3Aarmory')).toEqual(expected);
    expect(optQueryToSearchRequest('sets=grp:armory')).toEqual(expected);
  });

  it('returns null when the URL selects nothing (the page runs no search)', () => {
    expect(optQueryToSearchRequest('')).toBeNull();
    expect(optQueryToSearchRequest('sortBy=rarity')).toBeNull();
  });

  it('omits languages when the URL asks for all languages', () => {
    expect(optQueryToSearchRequest('classes=ninja&lang=all')?.filters.languages).toBeUndefined();
  });
});

describe('buildSearchRequest', () => {
  it('carries the requested page and page size into options', () => {
    const req = buildSearchRequest({
      filters: { classes: ['ninja'] }, languages: ['en'], sortBy: 'name', sortOrder: 'asc',
      groupByCard: true, page: 3, limit: 60,
    });
    expect(req).toEqual({
      filters: { classes: ['ninja'], languages: ['en'] },
      options: { page: 3, limit: 60, sortBy: 'name', sortOrder: 'asc', searchMode: 'strict', groupByCard: true },
    });
  });
});
