import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Tag, HandCoins, ArrowLeftRight } from 'lucide-react';
import type { ForYouSummary, PersonalizedGroup, TradePost, ViewerGroupMatch } from '@/lib/market-feed/personalize';
import type { FeedPost } from '@/lib/market-feed/group-posts';
import { AffiliateDisclosure } from '@/components/shared/AffiliateDisclosure';
import { BuyOnTcgplayer, PITCH_LABEL, PostLink, foilingName, formatMoney } from './feed-ui';
import { PostCard } from './PostCard';
import { FEED_REGIONS, FEED_REGION_LABELS, type FeedRegion } from '@/lib/market-feed/region';
import type {
  MarketFeedDateSummary,
  MarketFeedListing,
} from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export type FeedView = 'posts' | 'cards';

// region is only put in the URL when the viewer picks one (the page then
// remembers it); otherwise it is resolved per viewer on the server.
const feedHref = (date: string, today: string, view: FeedView = 'posts', region?: FeedRegion) => {
  const params = new URLSearchParams();
  if (date !== today) params.set('date', date);
  if (view === 'cards') params.set('view', 'cards');
  if (region) params.set('region', region);
  const qs = params.toString();
  return qs ? `/feed?${qs}` : '/feed';
};


function PriceList({ title, icon, items, empty }: {
  title: string;
  icon: ReactNode;
  items: MarketFeedListing[];
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">
        {icon}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((l) => (
            <li key={l.id} className="text-sm text-gray-900 dark:text-gray-100">
              <span className="font-semibold tabular-nums">
                {l.price != null ? formatMoney(l.price, l.currency) : 'Trade offer'}
              </span>
              {l.condition && <span className="text-gray-600 dark:text-gray-400"> · {l.condition}</span>}
              {l.groupName && (
                <span className="text-xs text-gray-500 dark:text-gray-400 break-words"> · {l.groupName}</span>
              )}
              {l.postUrl && (
                <>
                  {' · '}
                  <PostLink url={l.postUrl} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewerBadges({ g }: { g: PersonalizedGroup }) {
  const { have, onWants } = g.viewer;
  if (!have && !onWants) return null;
  const badge = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {have && (
        <span className={`${badge} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`}>
          You have {have.quantity}
          {have.forTradeQuantity > 0 && ` · ${have.forTradeQuantity} marked for trade`}
          {(g.foiling || g.variant) && (have.sameVersion ? ' · same version' : ' · different version')}
        </span>
      )}
      {onWants && (
        <span className={`${badge} bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300`}>
          On your wants list
        </span>
      )}
    </div>
  );
}

function CardGroup({ g }: { g: PersonalizedGroup }) {
  const foiling = foilingName(g.foiling);
  const href = g.cardUniqueId ? `/opt?q=${encodeURIComponent(g.name)}` : null;
  return (
    <li className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex gap-3">
      <div className="w-16 shrink-0">
        {g.imageUrl ? (
          <Image
            src={g.imageUrl}
            alt={g.name}
            width={64}
            height={89}
            className="rounded w-16 h-auto"
            unoptimized
          />
        ) : (
          <div className="w-16 h-[89px] rounded bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
            {href ? (
              <Link href={href} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
                {g.name}
              </Link>
            ) : (
              g.name
            )}
          </h2>
          {g.pitch && <span className="text-xs text-gray-600 dark:text-gray-400">{PITCH_LABEL[g.pitch]}</span>}
          {foiling && <span className="text-xs text-gray-600 dark:text-gray-400">{foiling}</span>}
          {g.variant && <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{g.variant}</span>}
          {g.collectorNumber && <span className="text-xs text-gray-600 dark:text-gray-400">{g.collectorNumber}</span>}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
          {g.tcgLow != null ? (
            <>TCG Low <span className="font-semibold text-green-700 dark:text-green-400">{formatMoney(g.tcgLow, 'USD')}</span></>
          ) : g.matched ? (
            'No TCG Low price'
          ) : (
            'Not matched to a card'
          )}
          {g.tcgplayerUrl && (
            <>
              {' · '}
              <BuyOnTcgplayer url={g.tcgplayerUrl} />
            </>
          )}
        </p>
        <ViewerBadges g={g} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <PriceList
            title="Selling"
            icon={<Tag className="w-3.5 h-3.5" aria-hidden="true" />}
            items={g.selling}
            empty="No asks"
          />
          <div className="space-y-2">
            <PriceList
              title="Buying"
              icon={<HandCoins className="w-3.5 h-3.5" aria-hidden="true" />}
              items={g.buying}
              empty="No offers"
            />
            {g.trading.length > 0 && (
              <PriceList
                title="Wanted in trade"
                icon={<ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />}
                items={g.trading}
                empty=""
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function TradePosts({ posts, signedIn }: { posts: TradePost[]; signedIn: boolean }) {
  return (
    <section id="trade-posts" aria-labelledby="trade-posts-heading" className="mb-6">
      <h2 id="trade-posts-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Trade posts
      </h2>
      <ul className="space-y-2">
        {posts.map((p) => (
          <li
            key={p.postUrl}
            className={`rounded-lg border p-3 ${
              p.youHave.length
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {p.offering.length ? <>Offering <span className="font-semibold">{p.offering.join(', ')}</span></> : 'Trade post'}
              {' · '}wants {p.wantsCount} card{p.wantsCount === 1 ? '' : 's'} in trade
              {p.groupName && <span className="text-xs text-gray-500 dark:text-gray-400"> · {p.groupName}</span>}
            </p>
            {p.youHave.length > 0 && (
              <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">
                You have {p.youHave.length}:{' '}
                {p.youHave
                  .map((w) => {
                    const asked = [w.variant, foilingName(w.foiling)].filter(Boolean).join(' ');
                    // They asked for a specific version the viewer may not have.
                    return asked && !w.sameVersion ? `${w.name} (they want ${asked})` : [w.name, asked].filter(Boolean).join(' ');
                  })
                  .join(', ')}
              </p>
            )}
            {signedIn && p.youHave.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">None of their wants are in your collection.</p>
            )}
            <div className="mt-2">
              <PostLink url={p.postUrl} label={p.youHave.length ? 'Make an offer on the post' : 'View post'} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ForYou({ forYou, signedIn, feedDate, today, view }: {
  forYou: ForYouSummary | null;
  signedIn: boolean;
  feedDate: string;
  today: string;
  view: FeedView;
}) {
  const box = 'mb-6 rounded-lg p-4 text-sm';
  if (!signedIn) {
    return (
      <div className={`${box} bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-gray-800 dark:text-gray-200`}>
        <Link
          href={`/auth/login?callbackUrl=${encodeURIComponent(feedHref(feedDate, today, view))}`}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Sign in
        </Link>{' '}
        to see which of these cards are in your collection or on your wants list.
      </div>
    );
  }
  if (!forYou) return null;
  const { cardsWantedYouOwn, cardsSoldYouWant, tradePostsYouCanOffer } = forYou;
  if (!cardsWantedYouOwn && !cardsSoldYouWant) {
    return (
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Nothing here matches your collection or wants list today.
      </p>
    );
  }
  return (
    <div className={`${box} bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-gray-900 dark:text-gray-100`}>
      <p className="font-semibold mb-1">For you</p>
      <ul className="list-disc pl-5 space-y-0.5">
        {cardsWantedYouOwn > 0 && (
          <li>{cardsWantedYouOwn} card{cardsWantedYouOwn === 1 ? '' : 's'} people want {cardsWantedYouOwn === 1 ? 'is' : 'are'} in your collection</li>
        )}
        {tradePostsYouCanOffer > 0 && (
          <li>
            <a href={view === 'posts' ? '#posts' : '#trade-posts'} className="text-blue-600 dark:text-blue-400 hover:underline">
              {tradePostsYouCanOffer} trade post{tradePostsYouCanOffer === 1 ? '' : 's'} you could make an offer on
            </a>
          </li>
        )}
        {cardsSoldYouWant > 0 && (
          <li>{cardsSoldYouWant} card{cardsSoldYouWant === 1 ? '' : 's'} on your wants list {cardsSoldYouWant === 1 ? 'is' : 'are'} for sale</li>
        )}
      </ul>
    </div>
  );
}

export function MarketFeedView({
  feedDate,
  today,
  view,
  region,
  signedIn,
  groups,
  posts,
  byListing,
  tradePosts,
  forYou,
  dates,
  error,
}: {
  feedDate: string;
  today: string;
  view: FeedView;
  region: FeedRegion;
  signedIn: boolean;
  groups: PersonalizedGroup[];
  posts: FeedPost[];
  byListing: Record<string, ViewerGroupMatch>;
  tradePosts: TradePost[];
  forYou: ForYouSummary | null;
  dates: MarketFeedDateSummary[];
  error: string | null;
}) {
  // dates is newest first; step to the nearest day that has listings.
  const older = dates.find((d) => d.feedDate < feedDate)?.feedDate ?? null;
  const newer = [...dates].reverse().find((d) => d.feedDate > feedDate)?.feedDate ?? null;
  const listingCount = groups.reduce((n, g) => n + g.selling.length + g.buying.length + g.trading.length, 0);

  const navLink =
    'inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1 py-2';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Market Feed</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {FEED_REGION_LABELS[region]} · {dateLabel(feedDate)}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
            Prices players asked and offered for cards in Flesh and Blood buy/sell groups that day, next to the
            TCGplayer low price. Collected daily, with no names attached. It&apos;s a reference point, not a live listing.
          </p>
        </div>

        <nav aria-label="Region" className="flex flex-wrap gap-2 mb-2">
          {FEED_REGIONS.map((r) => (
            <Link
              key={r}
              href={feedHref(feedDate, today, view, r)}
              aria-current={region === r ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                region === r
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {FEED_REGION_LABELS[r]}
            </Link>
          ))}
        </nav>

        <nav aria-label="Feed days" className="flex items-center justify-between gap-2 mb-4">
          {older ? (
            <Link href={feedHref(older, today, view)} className={navLink}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {shortDate(older)}
            </Link>
          ) : (
            <span />
          )}
          {newer ? (
            <Link href={feedHref(newer, today, view)} className={navLink}>
              {shortDate(newer)} <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          ) : feedDate !== today ? (
            <Link href={feedHref(today, today, view)} className={navLink}>
              Today <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>

        {error ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            {error}
          </p>
        ) : groups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-sm text-gray-700 dark:text-gray-300">
            No listings for this day{feedDate === today ? ' yet' : ''}.
            {older && (
              <>
                {' '}
                <Link href={feedHref(older, today)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  See {shortDate(older)}
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <>
            <AffiliateDisclosure />
            <ForYou forYou={forYou} signedIn={signedIn} feedDate={feedDate} today={today} view={view} />
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {listingCount} listing{listingCount === 1 ? '' : 's'} ·{' '}
                {view === 'posts'
                  ? `${posts.length} post${posts.length === 1 ? '' : 's'}`
                  : `${groups.length} card${groups.length === 1 ? '' : 's'}`}
              </p>
              <nav aria-label="Feed layout" className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs font-medium">
                {(['posts', 'cards'] as const).map((v) => (
                  <Link
                    key={v}
                    href={feedHref(feedDate, today, v)}
                    aria-current={view === v ? 'page' : undefined}
                    className={`px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      view === v
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {v === 'posts' ? 'By post' : 'By card'}
                  </Link>
                ))}
              </nav>
            </div>
            {view === 'posts' ? (
              <ul id="posts" className="space-y-3">
                {posts.map((p) => (
                  <PostCard key={p.key} post={p} byListing={byListing} />
                ))}
              </ul>
            ) : (
              <>
                {tradePosts.length > 0 && <TradePosts posts={tradePosts} signedIn={signedIn} />}
                <ul className="space-y-3">
                  {groups.map((g) => (
                    <CardGroup key={g.key} g={g} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
