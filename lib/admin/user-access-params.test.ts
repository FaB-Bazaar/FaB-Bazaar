import { describe, it, expect } from 'vitest';
import { parseUserAccessParams, userAccessHref, USER_ACCESS_PAGE_SIZE } from './user-access-params';

describe('parseUserAccessParams', () => {
  it('defaults to page 1 with no search', () => {
    expect(parseUserAccessParams({})).toEqual({ page: 1, searchTerm: '' });
  });

  it('reads page and a trimmed search term', () => {
    expect(parseUserAccessParams({ page: '3', q: '  cakes ' })).toEqual({ page: 3, searchTerm: 'cakes' });
  });

  it('falls back to page 1 for junk, zero or negative pages', () => {
    for (const page of ['abc', '0', '-2', '1.5', '']) {
      expect(parseUserAccessParams({ page }).page).toBe(1);
    }
  });

  it('takes the first value of a repeated param', () => {
    expect(parseUserAccessParams({ page: ['2', '7'], q: ['a', 'b'] })).toEqual({ page: 2, searchTerm: 'a' });
  });

  it('caps the search term length', () => {
    expect(parseUserAccessParams({ q: 'x'.repeat(500) }).searchTerm).toHaveLength(100);
  });
});

describe('userAccessHref', () => {
  it('omits page 1 and an empty search', () => {
    expect(userAccessHref({ page: 1, searchTerm: '' })).toBe('/admin/user-access');
  });

  it('encodes the search term and keeps the page', () => {
    expect(userAccessHref({ page: 2, searchTerm: 'a b&c' })).toBe('/admin/user-access?q=a+b%26c&page=2');
  });
});

describe('USER_ACCESS_PAGE_SIZE', () => {
  it('fills whole rows of the 1/2/3-column grid', () => {
    expect(USER_ACCESS_PAGE_SIZE % 6).toBe(0);
  });
});
