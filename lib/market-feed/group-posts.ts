import type { MarketFeedListing } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';
import type { ViewerGroupMatch } from './personalize';

export interface FeedPost {
  key: string;
  /** null = the listing came without a link (shown as its own item). */
  postUrl: string | null;
  groupName: string | null;
  selling: MarketFeedListing[];
  buying: MarketFeedListing[];
  trading: MarketFeedListing[];
  /** Listings in this post that match the viewer (have / on wants). */
  matchCount: number;
}

/**
 * One item per Facebook post — a post often sells many cards at once, and
 * splitting it across per-card boxes buries it. Posts that match the viewer
 * come first, then the biggest posts.
 */
export function groupFeedPosts(
  listings: MarketFeedListing[],
  byListing: Record<string, ViewerGroupMatch> = {},
): FeedPost[] {
  const posts = new Map<string, FeedPost>();
  for (const l of listings) {
    const key = l.postUrl ?? `listing:${l.id}`;
    let post = posts.get(key);
    if (!post) {
      post = { key, postUrl: l.postUrl, groupName: l.groupName, selling: [], buying: [], trading: [], matchCount: 0 };
      posts.set(key, post);
    }
    (l.side === 'selling' ? post.selling : l.side === 'buying' ? post.buying : post.trading).push(l);
    const v = byListing[l.id];
    if (v?.have || v?.onWants) post.matchCount++;
  }
  const size = (p: FeedPost) => p.selling.length + p.buying.length + p.trading.length;
  return [...posts.values()].sort((a, b) => b.matchCount - a.matchCount || size(b) - size(a));
}
