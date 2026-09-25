import { describe, it, expect } from 'vitest';
import { personalizeFeed } from './personalize';
import { groupFeedListings } from './group-listings';
import type { MarketFeedListing, MarketFeedViewerMatches } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

const POST = 'https://www.facebook.com/groups/1/posts/2/';
const base: MarketFeedListing = {
  id: 'x', side: 'selling', cardName: 'X', cardUniqueId: 'cu-x', displayName: 'X', pitch: null,
  collectorNumber: null, foiling: null, condition: null, price: 1, currency: 'USD', groupName: 'G',
  postUrl: null, variant: null, tcgLow: null, tcgplayerUrl: null, imageUrl: null,
};
let n = 0;
const l = (over: Partial<MarketFeedListing>): MarketFeedListing => ({ ...base, id: `l${n++}`, ...over });

const none: MarketFeedViewerMatches = { owned: {}, wanted: {} };

describe('personalizeFeed', () => {
  // The Usurp post: offering Usurps, wants Dead Threads CF + Eye of Ophidia in trade.
  const listings = [
    l({ side: 'selling', cardName: 'Usurp the Shadow Throne', displayName: 'Usurp the Shadow Throne', cardUniqueId: 'usurp', foiling: 'r', price: 40, postUrl: POST }),
    l({ side: 'trade', cardName: 'Dead Threads', displayName: 'Dead Threads', cardUniqueId: 'threads', foiling: 'c', price: null, postUrl: POST }),
    l({ side: 'trade', cardName: 'Eye of Ophidia', displayName: 'Eye of Ophidia', cardUniqueId: 'eye', price: null, postUrl: POST }),
    l({ side: 'trade', cardName: 'Anka, Drag Under', displayName: 'Anka, Drag Under', cardUniqueId: 'anka', variant: 'Marvel', price: null, postUrl: POST }),
    l({ side: 'buying', cardName: 'Snatch', displayName: 'Snatch', cardUniqueId: 'snatch', price: 2 }),
    l({ side: 'selling', cardName: 'Command and Conquer', displayName: 'Command and Conquer', cardUniqueId: 'cnc', price: 12 }),
  ];

  const matches: MarketFeedViewerMatches = {
    owned: {
      threads: { quantity: 1, forTradeQuantity: 0, foilings: ['r'], variants: [] },
      eye: { quantity: 2, forTradeQuantity: 1, foilings: ['c'], variants: [] },
      snatch: { quantity: 3, forTradeQuantity: 3, foilings: ['s'], variants: [] },
      anka: { quantity: 3, forTradeQuantity: 0, foilings: ['s'], variants: [] },
      usurp: { quantity: 1, forTradeQuantity: 0, foilings: ['r'], variants: [] }, // only for sale here — not "wanted"
    },
    wanted: { cnc: { foilings: ['s'] } },
  };

  it('marks cards people want that the viewer owns, flagging an exact foiling match', () => {
    const { groups } = personalizeFeed(groupFeedListings(listings), listings, matches);
    const byName = Object.fromEntries(groups.map((g) => [g.name, g.viewer]));
    // Post asked for Cold Foil, viewer owns Rainbow — still a match, not exact.
    expect(byName['Dead Threads']?.have).toEqual({ quantity: 1, forTradeQuantity: 0, sameVersion: false });
    // Post named no foiling — any copy is exact.
    expect(byName['Eye of Ophidia']?.have).toEqual({ quantity: 2, forTradeQuantity: 1, sameVersion: true });
    // Post wants the Marvel; viewer's copies are regular — a match, but a different version.
    expect(byName['Anka, Drag Under']?.have?.sameVersion).toBe(false);
    expect(byName['Snatch']?.have?.quantity).toBe(3);
    // Owning a card someone is only SELLING is not a match.
    expect(byName['Usurp the Shadow Throne']?.have).toBeUndefined();
  });

  it("marks cards being sold that are on the viewer's wants list", () => {
    const { groups } = personalizeFeed(groupFeedListings(listings), listings, matches);
    expect(groups.find((g) => g.name === 'Command and Conquer')?.viewer.onWants).toBe(true);
    expect(groups.find((g) => g.name === 'Snatch')?.viewer.onWants).toBeFalsy();
  });

  it('summarises trade posts by what the viewer can offer, best first', () => {
    const { tradePosts } = personalizeFeed(groupFeedListings(listings), listings, matches);
    expect(tradePosts).toHaveLength(1);
    expect(tradePosts[0]).toMatchObject({
      postUrl: POST,
      groupName: 'G',
      offering: ['Usurp the Shadow Throne'],
      wantsCount: 3,
    });
    expect(tradePosts[0].youHave.map((w) => [w.name, w.sameVersion])).toEqual([
      ['Dead Threads', false], ['Eye of Ophidia', true], ['Anka, Drag Under', false],
    ]);
  });

  it('flags individual listings too (for the post-first view)', () => {
    const { byListing } = personalizeFeed(groupFeedListings(listings), listings, matches);
    const flag = (name: string, side: string) => byListing[listings.find((x) => x.displayName === name && x.side === side)!.id];
    expect(flag('Dead Threads', 'trade')?.have?.sameVersion).toBe(false);
    expect(flag('Eye of Ophidia', 'trade')?.have?.sameVersion).toBe(true);
    expect(flag('Command and Conquer', 'selling')?.onWants).toBe(true);
    // The viewer owns the Usurp, but it is being sold — not something to offer.
    expect(flag('Usurp the Shadow Throne', 'selling')).toBeUndefined();
  });

  it('counts the "for you" summary', () => {
    const { forYou } = personalizeFeed(groupFeedListings(listings), listings, matches);
    expect(forYou).toEqual({ cardsWantedYouOwn: 4, cardsSoldYouWant: 1, tradePostsYouCanOffer: 1 });
  });

  it('still lists trade posts (with nothing matched) for a signed-out viewer', () => {
    const { groups, tradePosts, forYou } = personalizeFeed(groupFeedListings(listings), listings, null);
    expect(groups.every((g) => !g.viewer.have && !g.viewer.onWants)).toBe(true);
    expect(tradePosts[0].youHave).toEqual([]);
    expect(forYou).toBeNull();
  });

  it('ignores trade listings without a post link (nothing to act on)', () => {
    const noLink = listings.map((x) => ({ ...x, postUrl: null }));
    expect(personalizeFeed(groupFeedListings(noLink), noLink, none).tradePosts).toEqual([]);
  });
});
