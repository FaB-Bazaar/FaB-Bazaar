import type { MarketFeedListing } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

export interface FeedCardGroup {
  key: string;
  name: string;
  matched: boolean;
  cardUniqueId: string | null;
  pitch: number | null;
  foiling: string | null;
  collectorNumber: string | null;
  variant: string | null;
  tcgLow: number | null;
  tcgplayerUrl: string | null;
  imageUrl: string | null;
  /** Cheapest ask first. */
  selling: MarketFeedListing[];
  /** Highest bid first. */
  buying: MarketFeedListing[];
  /** Wanted in exchange ("willing to trade for"). */
  trading: MarketFeedListing[];
}

const size = (g: FeedCardGroup) => g.selling.length + g.buying.length + g.trading.length;

/**
 * One group per card + foiling + collector number + variant (they price differently);
 * unmatched listings group by the name the post gave. Busiest cards first.
 */
export function groupFeedListings(listings: MarketFeedListing[]): FeedCardGroup[] {
  const groups = new Map<string, FeedCardGroup>();
  for (const l of listings) {
    const key = l.cardUniqueId
      ? `${l.cardUniqueId}|${l.foiling ?? ''}|${l.collectorNumber ?? ''}|${l.variant ?? ''}`
      : `name:${l.cardName.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: l.displayName ?? l.cardName,
        matched: !!l.cardUniqueId,
        cardUniqueId: l.cardUniqueId,
        pitch: l.pitch,
        foiling: l.foiling,
        collectorNumber: l.collectorNumber,
        variant: l.variant,
        tcgLow: l.tcgLow,
        tcgplayerUrl: l.tcgplayerUrl,
        imageUrl: l.imageUrl,
        selling: [],
        buying: [],
        trading: [],
      };
      groups.set(key, g);
    }
    (l.side === 'selling' ? g.selling : l.side === 'buying' ? g.buying : g.trading).push(l);
  }
  const result = [...groups.values()];
  for (const g of result) {
    g.selling.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    g.buying.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }
  return result.sort(
    (a, b) => size(b) - size(a) || a.name.localeCompare(b.name)
  );
}
