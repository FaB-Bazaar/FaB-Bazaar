// app/feed/page.tsx
//
// Market Feed — a curated, anonymous daily feed of buy/sell prices seen in
// Flesh and Blood Facebook groups (submitted via the superadmin
// submit_market_feed MCP tool). A price reference next to TCG Low.
// Server component: one day per page, ?date=YYYY-MM-DD, default today (ET).

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { marketFeedService } from '@/lib/services';
import { marketFeedToday } from '@/lib/market-feed/feed-date';
import { groupFeedListings } from '@/lib/market-feed/group-listings';
import { isValidFeedDate } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';
import { MarketFeedView } from './MarketFeedView';

export const metadata: Metadata = {
  title: 'Market Feed',
  description:
    'What Flesh and Blood players are asking and offering for cards in community buy/sell groups, day by day, next to TCGplayer prices.',
};

export default async function MarketFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requested } = await searchParams;
  const today = marketFeedToday();
  const feedDate = requested && isValidFeedDate(requested) ? requested : today;

  const [day, dates] = await Promise.all([marketFeedService.getDay(feedDate), marketFeedService.listDates()]);
  const error = !day.success ? day.error : !dates.success ? dates.error : null;

  return (
    <MarketFeedView
      feedDate={feedDate}
      today={today}
      groups={day.success ? groupFeedListings(day.data.listings) : []}
      dates={dates.success ? dates.data : []}
      error={error}
    />
  );
}
