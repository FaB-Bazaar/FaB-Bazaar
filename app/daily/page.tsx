// app/daily/page.tsx
//
// Daily Movers — two-tier server-rendered page:
//   1. "Your movers" — pipeline signals intersected with the viewer's
//      inventory, led by the net dollar impact on their holdings.
//   2. "Around the market" — the full site-wide signal set, so the page has
//      content every day even when the viewer's cards were quiet (and for
//      anonymous visitors, who see only this tier plus a sign-in CTA).
//
// Server component: data arrives with the HTML — no client fetch, no spinner.

export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { dailyMoversService } from '@/lib/services';
import type {
  MarketMoversDTO,
  MoversInCollectionDTO,
} from '@/lib/services/contracts/IDailyMoversService';
import { DailyMoversView } from './DailyMoversView';

export default async function DailyMoversPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let userMovers: MoversInCollectionDTO | null = null;
  let market: MarketMoversDTO | null = null;
  let error: string | null = null;

  try {
    const [userResult, marketResult] = await Promise.all([
      userId
        ? dailyMoversService.getMoversInUserCollection(userId)
        : Promise.resolve(null),
      dailyMoversService.getMarketMovers(),
    ]);

    if (userResult) {
      if (userResult.success) userMovers = userResult.data;
      else error = userResult.error;
    }
    if (marketResult.success) market = marketResult.data;
    else error = error ?? marketResult.error;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load daily movers';
  }

  return (
    <DailyMoversView
      signedIn={!!userId}
      userMovers={userMovers}
      market={market}
      error={userMovers === null && market === null ? error : null}
    />
  );
}
