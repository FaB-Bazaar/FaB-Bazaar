// lib/search-url-params.test.ts

import { describe, it, expect } from 'vitest';
import { urlParamsToFilters, filtersToURLParams } from './search-url-params';

describe('search-url-params — languages filter', () => {
  it('round-trips the languages array through URL params', () => {
    const params = filtersToURLParams({ name: 'sink below', languages: ['en', 'fr'] } as any, {});
    expect(params.get('languages')).toBe('en,fr');

    const { filters } = urlParamsToFilters(params);
    expect(filters.languages).toEqual(['en', 'fr']);
  });

  it('omits languages when not set', () => {
    const params = filtersToURLParams({ name: 'sink below' } as any, {});
    expect(params.get('languages')).toBeNull();

    const { filters } = urlParamsToFilters(params);
    expect(filters.languages).toBeUndefined();
  });
});
