import { describe, it, expect } from 'vitest';
import { groupFeedListings } from './group-listings';
import type { MarketFeedListing } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

const base: MarketFeedListing = {
  id: 'x', side: 'selling', cardName: 'Sink Below', cardUniqueId: 'cu-1', displayName: 'Sink Below',
  pitch: 1, collectorNumber: null, foiling: null, condition: null, price: 1, currency: 'USD',
  groupName: null, tcgLow: 0.5, imageUrl: 'img',
};
const l = (over: Partial<MarketFeedListing>): MarketFeedListing => ({ ...base, id: Math.random().toString(), ...over });

describe('groupFeedListings', () => {
  it('groups one card+foiling into one entry with selling and buying split, cheapest ask / highest bid first', () => {
    const groups = groupFeedListings([
      l({ side: 'selling', price: 3 }),
      l({ side: 'buying', price: 1 }),
      l({ side: 'selling', price: 2 }),
      l({ side: 'buying', price: 1.5 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].selling.map((x) => x.price)).toEqual([2, 3]);
    expect(groups[0].buying.map((x) => x.price)).toEqual([1.5, 1]);
    expect(groups[0].tcgLow).toBe(0.5);
  });

  it('keeps foilings and collector numbers of the same card apart (they price differently)', () => {
    const groups = groupFeedListings([
      l({ foiling: 'r' }),
      l({ foiling: null }),
      l({ foiling: 'r', collectorNumber: 'WTR171' }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it('groups unmatched listings by the name the post gave, case-insensitively', () => {
    const groups = groupFeedListings([
      l({ cardUniqueId: null, displayName: null, cardName: 'Mystery Card', tcgLow: null }),
      l({ cardUniqueId: null, displayName: null, cardName: 'mystery card', tcgLow: null }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Mystery Card');
    expect(groups[0].matched).toBe(false);
  });

  it('orders groups by number of listings, then name', () => {
    const groups = groupFeedListings([
      l({ cardUniqueId: 'a', displayName: 'Zeta' }),
      l({ cardUniqueId: 'b', displayName: 'Alpha' }),
      l({ cardUniqueId: 'a', displayName: 'Zeta' }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Zeta', 'Alpha']);
  });
});
