import type { MarketFeedListing } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

export interface FeedCardGroup {
  key: string;
  name: string;
  matched: boolean;
  cardUniqueId: string | null;
  pitch: number | null;
  foiling: string | null;
  collectorNumber: string | null;
  tcgLow: number | null;
  imageUrl: string | null;
  /** Cheapest ask first. */
  selling: MarketFeedListing[];
  /** Highest bid first. */
  buying: MarketFeedListing[];
}

/**
 * One group per card + foiling + collector number (they price differently);
 * unmatched listings group by the name the post gave. Busiest cards first.
 */
export function groupFeedListings(listings: MarketFeedListing[]): FeedCardGroup[] {
  const groups = new Map<string, FeedCardGroup>();
  for (const l of listings) {
    const key = l.cardUniqueId
      ? `${l.cardUniqueId}|${l.foiling ?? ''}|${l.collectorNumber ?? ''}`
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
        tcgLow: l.tcgLow,
        imageUrl: l.imageUrl,
        selling: [],
        buying: [],
      };
      groups.set(key, g);
    }
    (l.side === 'selling' ? g.selling : g.buying).push(l);
  }
  const result = [...groups.values()];
  for (const g of result) {
    g.selling.sort((a, b) => a.price - b.price);
    g.buying.sort((a, b) => b.price - a.price);
  }
  return result.sort(
    (a, b) => b.selling.length + b.buying.length - (a.selling.length + a.buying.length) || a.name.localeCompare(b.name)
  );
}
