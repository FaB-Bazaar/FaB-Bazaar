import type { FeedCardGroup } from './group-listings';
import type {
  MarketFeedListing,
  MarketFeedViewerMatches,
} from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

export interface ViewerGroupMatch {
  /**
   * Someone is buying / wants this in trade, and the viewer owns copies.
   * sameVersion: the viewer owns the foiling AND variant the post asked for.
   */
  have?: { quantity: number; forTradeQuantity: number; sameVersion: boolean };
  /** Someone is selling this, and it is on the viewer's wants list. */
  onWants?: boolean;
}

export type PersonalizedGroup = FeedCardGroup & { viewer: ViewerGroupMatch };

export interface TradePostWant {
  name: string;
  foiling: string | null;
  variant: string | null;
  sameVersion: boolean;
}

export interface TradePost {
  postUrl: string;
  groupName: string | null;
  /** What the poster is offering (their selling listings in the same post). */
  offering: string[];
  wantsCount: number;
  /** The cards they want that the viewer owns. */
  youHave: TradePostWant[];
}

export interface ForYouSummary {
  cardsWantedYouOwn: number;
  cardsSoldYouWant: number;
  tradePostsYouCanOffer: number;
}

const nameOf = (l: MarketFeedListing) => l.displayName ?? l.cardName;
type Owned = MarketFeedViewerMatches['owned'][string];
// Nothing asked for = any copy counts. Card-level ownership is tracked per
// card, so foiling and variant are checked independently (a best-effort
// "you may own the exact version", not a per-printing guarantee).
const sameVersion = (foiling: string | null, variant: string | null, owned: Owned) =>
  (foiling == null || owned.foilings.includes(foiling)) && (variant == null || owned.variants.includes(variant));

/**
 * Annotate a day's feed for one viewer (null = signed out): which wanted cards
 * they own, which sold cards they want, and the trade posts they could answer.
 * Card-level matching (any copy counts); sameVersion flags a foiling + variant match.
 */
export function personalizeFeed(
  groups: FeedCardGroup[],
  listings: MarketFeedListing[],
  matches: MarketFeedViewerMatches | null,
): { groups: PersonalizedGroup[]; tradePosts: TradePost[]; forYou: ForYouSummary | null } {
  const personalized = groups.map((g): PersonalizedGroup => {
    const viewer: ViewerGroupMatch = {};
    const owned = g.cardUniqueId ? matches?.owned[g.cardUniqueId] : undefined;
    if (owned && g.buying.length + g.trading.length > 0) {
      viewer.have = {
        quantity: owned.quantity,
        forTradeQuantity: owned.forTradeQuantity,
        sameVersion: sameVersion(g.foiling, g.variant, owned),
      };
    }
    if (g.cardUniqueId && g.selling.length > 0 && matches?.wanted[g.cardUniqueId]) viewer.onWants = true;
    return { ...g, viewer };
  });

  const posts = new Map<string, TradePost>();
  for (const l of listings) {
    if (l.side !== 'trade' || !l.postUrl) continue;
    let post = posts.get(l.postUrl);
    if (!post) {
      const offering = listings.filter((o) => o.postUrl === l.postUrl && o.side === 'selling').map(nameOf);
      post = { postUrl: l.postUrl, groupName: l.groupName, offering: [...new Set(offering)], wantsCount: 0, youHave: [] };
      posts.set(l.postUrl, post);
    }
    post.wantsCount++;
    const owned = l.cardUniqueId ? matches?.owned[l.cardUniqueId] : undefined;
    if (owned) {
      post.youHave.push({ name: nameOf(l), foiling: l.foiling, variant: l.variant, sameVersion: sameVersion(l.foiling, l.variant, owned) });
    }
  }
  const tradePosts = [...posts.values()].sort(
    (a, b) => b.youHave.length - a.youHave.length || b.wantsCount - a.wantsCount,
  );

  const forYou = matches
    ? {
        cardsWantedYouOwn: personalized.filter((g) => g.viewer.have).length,
        cardsSoldYouWant: personalized.filter((g) => g.viewer.onWants).length,
        tradePostsYouCanOffer: tradePosts.filter((p) => p.youHave.length > 0).length,
      }
    : null;

  return { groups: personalized, tradePosts, forYou };
}
