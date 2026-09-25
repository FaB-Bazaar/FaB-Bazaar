// app/feed/page.tsx
//
// Market Feed — a curated, anonymous daily feed of buy/sell prices seen in
// Flesh and Blood Facebook groups (submitted via the superadmin
// submit_market_feed MCP tool). A price reference next to TCG Low.
// Server component: one day per page, ?date=YYYY-MM-DD, default today (ET).
// Signed-in viewers also see which wanted cards they own / which sold cards
// they want (their own collection only, matched server-side).

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { marketFeedService } from '@/lib/services';
import { marketFeedToday } from '@/lib/market-feed/feed-date';
import { groupFeedListings } from '@/lib/market-feed/group-listings';
import { personalizeFeed } from '@/lib/market-feed/personalize';
import { groupFeedPosts } from '@/lib/market-feed/group-posts';
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
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { date: requested, view: requestedView } = await searchParams;
  // By post is the default: a post often sells many cards at once.
  const view = requestedView === 'cards' ? 'cards' : 'posts';
  const today = marketFeedToday();
  const feedDate = requested && isValidFeedDate(requested) ? requested : today;

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [day, dates, matches] = await Promise.all([
    marketFeedService.getDay(feedDate),
    marketFeedService.listDates(),
    userId ? marketFeedService.getViewerMatches(userId, feedDate) : Promise.resolve(null),
  ]);
  const error = !day.success ? day.error : !dates.success ? dates.error : null;
  const listings = day.success ? day.data.listings : [];
  // A failed match lookup degrades to the anonymous view rather than an error page.
  const { groups, byListing, tradePosts, forYou } = personalizeFeed(
    groupFeedListings(listings),
    listings,
    matches?.success ? matches.data : null,
  );

  return (
    <MarketFeedView
      feedDate={feedDate}
      today={today}
      view={view}
      signedIn={!!userId}
      groups={groups}
      posts={groupFeedPosts(listings, byListing)}
      byListing={byListing}
      tradePosts={tradePosts}
      forYou={forYou}
      dates={dates.success ? dates.data : []}
      error={error}
    />
  );
}
