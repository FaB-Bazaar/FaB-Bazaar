import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Tag, HandCoins } from 'lucide-react';
import { FOILING_MAP } from '@/lib/fab-constants';
import type { FeedCardGroup } from '@/lib/market-feed/group-listings';
import type {
  MarketFeedDateSummary,
  MarketFeedListing,
} from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

const PITCH_LABEL: Record<number, string> = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

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

const feedHref = (date: string, today: string) => (date === today ? '/feed' : `/feed?date=${date}`);

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
              <span className="font-semibold tabular-nums">{formatMoney(l.price, l.currency)}</span>
              {l.condition && <span className="text-gray-600 dark:text-gray-400"> · {l.condition}</span>}
              {l.groupName && (
                <span className="text-xs text-gray-500 dark:text-gray-400 break-words"> · {l.groupName}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CardGroup({ g }: { g: FeedCardGroup }) {
  const foiling = g.foiling ? (FOILING_MAP as Record<string, string>)[g.foiling] : null;
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
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <PriceList
            title="Selling"
            icon={<Tag className="w-3.5 h-3.5" aria-hidden="true" />}
            items={g.selling}
            empty="No asks"
          />
          <PriceList
            title="Buying"
            icon={<HandCoins className="w-3.5 h-3.5" aria-hidden="true" />}
            items={g.buying}
            empty="No offers"
          />
        </div>
      </div>
    </li>
  );
}

export function MarketFeedView({
  feedDate,
  today,
  groups,
  dates,
  error,
}: {
  feedDate: string;
  today: string;
  groups: FeedCardGroup[];
  dates: MarketFeedDateSummary[];
  error: string | null;
}) {
  // dates is newest first; step to the nearest day that has listings.
  const older = dates.find((d) => d.feedDate < feedDate)?.feedDate ?? null;
  const newer = [...dates].reverse().find((d) => d.feedDate > feedDate)?.feedDate ?? null;
  const listingCount = groups.reduce((n, g) => n + g.selling.length + g.buying.length, 0);

  const navLink =
    'inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1 py-2';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Market Feed</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{dateLabel(feedDate)}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
            Prices players asked and offered for cards in Flesh and Blood buy/sell groups that day, next to the
            TCGplayer low price. Collected daily, with no names attached. It&apos;s a reference point, not a live listing.
          </p>
        </div>

        <nav aria-label="Feed days" className="flex items-center justify-between gap-2 mb-4">
          {older ? (
            <Link href={feedHref(older, today)} className={navLink}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {shortDate(older)}
            </Link>
          ) : (
            <span />
          )}
          {newer ? (
            <Link href={feedHref(newer, today)} className={navLink}>
              {shortDate(newer)} <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          ) : feedDate !== today ? (
            <Link href="/feed" className={navLink}>
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
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {listingCount} listing{listingCount === 1 ? '' : 's'} across {groups.length} card{groups.length === 1 ? '' : 's'}
            </p>
            <ul className="space-y-3">
              {groups.map((g) => (
                <CardGroup key={g.key} g={g} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
