import { describe, it, expect } from 'vitest';
import { groupFeedPosts } from './group-posts';
import type { MarketFeedListing } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

const base: MarketFeedListing = {
  id: 'x', side: 'selling', cardName: 'X', cardUniqueId: 'cu', displayName: 'X', pitch: null, collectorNumber: null,
  foiling: null, condition: null, price: 1, currency: 'USD', groupName: 'G', postUrl: null, variant: null,
  tcgLow: null, tcgplayerUrl: null, imageUrl: null,
};
let n = 0;
const l = (over: Partial<MarketFeedListing>): MarketFeedListing => ({ ...base, id: `l${n++}`, ...over });
const A = 'https://www.facebook.com/groups/1/posts/a/';
const B = 'https://www.facebook.com/groups/1/posts/b/';

describe('groupFeedPosts', () => {
  it('puts every card from one post into one item, split by side', () => {
    const posts = groupFeedPosts([
      l({ postUrl: A, displayName: 'Circlet', price: 65 }),
      l({ postUrl: A, displayName: 'Danse Macabre', price: 65 }),
      l({ postUrl: A, side: 'trade', displayName: 'Dead Threads', price: null }),
      l({ postUrl: B, displayName: 'Circlet', price: 55 }),
    ]);
    expect(posts).toHaveLength(2);
    const a = posts.find((p) => p.postUrl === A)!;
    expect(a.selling.map((x) => x.displayName)).toEqual(['Circlet', 'Danse Macabre']);
    expect(a.trading.map((x) => x.displayName)).toEqual(['Dead Threads']);
    expect(a.groupName).toBe('G');
  });

  it('keeps listings without a post link as their own items', () => {
    const posts = groupFeedPosts([l({ postUrl: null }), l({ postUrl: null })]);
    expect(posts).toHaveLength(2);
    expect(posts.every((p) => p.postUrl === null)).toBe(true);
  });

  it('orders the posts with viewer matches first, then the biggest posts', () => {
    const small = l({ postUrl: B, displayName: 'Match me' });
    const posts = groupFeedPosts(
      [l({ postUrl: A }), l({ postUrl: A }), l({ postUrl: A }), small],
      { [small.id]: { onWants: true } },
    );
    expect(posts.map((p) => p.postUrl)).toEqual([B, A]);
    expect(posts[0].matchCount).toBe(1);
  });
});
