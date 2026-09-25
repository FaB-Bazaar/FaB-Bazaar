import Image from 'next/image';
import Link from 'next/link';
import type { FeedPost } from '@/lib/market-feed/group-posts';
import type { ViewerGroupMatch } from '@/lib/market-feed/personalize';
import type { MarketFeedListing } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';
import { BuyOnTcgplayer, PITCH_LABEL, PostLink, foilingName, formatMoney } from './feed-ui';

function ListingRow({ l, viewer }: { l: MarketFeedListing; viewer?: ViewerGroupMatch }) {
  const name = l.displayName ?? l.cardName;
  const tags = [l.pitch ? PITCH_LABEL[l.pitch] : null, foilingName(l.foiling), l.condition, l.collectorNumber].filter(Boolean);
  const badge = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  return (
    <li className="flex gap-3 py-2">
      <div className="w-10 shrink-0">
        {l.imageUrl ? (
          <Image src={l.imageUrl} alt="" width={40} height={56} className="rounded w-10 h-auto" unoptimized />
        ) : (
          <div className="w-10 h-14 rounded bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">
            {l.cardUniqueId ? (
              <Link href={`/opt?q=${encodeURIComponent(name)}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
                {name}
              </Link>
            ) : (
              name
            )}
          </span>
          {l.variant && <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{l.variant}</span>}
          {tags.length > 0 && <span className="text-xs text-gray-600 dark:text-gray-400">{tags.join(' · ')}</span>}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
          {l.tcgLow != null ? (
            <>TCG Low <span className="font-semibold text-green-700 dark:text-green-400">{formatMoney(l.tcgLow, 'USD')}</span></>
          ) : l.cardUniqueId ? (
            'No TCG Low price'
          ) : (
            'Not matched to a card'
          )}
          {l.tcgplayerUrl && (
            <>
              {' · '}
              <BuyOnTcgplayer url={l.tcgplayerUrl} />
            </>
          )}
        </p>
        {viewer?.have && (
          <span className={`${badge} mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`}>
            You have {viewer.have.quantity}
            {viewer.have.forTradeQuantity > 0 && ` · ${viewer.have.forTradeQuantity} marked for trade`}
            {(l.foiling || l.variant) && (viewer.have.sameVersion ? ' · same version' : ' · different version')}
          </span>
        )}
        {viewer?.onWants && (
          <span className={`${badge} mt-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300`}>On your wants list</span>
        )}
      </div>
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {l.price != null ? formatMoney(l.price, l.currency) : <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Trade</span>}
      </div>
    </li>
  );
}

function Section({ title, items, byListing }: { title: string; items: MarketFeedListing[]; byListing: Record<string, ViewerGroupMatch> }) {
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{title}</h3>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((l) => (
          <ListingRow key={l.id} l={l} viewer={byListing[l.id]} />
        ))}
      </ul>
    </div>
  );
}

export function PostCard({ post, byListing }: { post: FeedPost; byListing: Record<string, ViewerGroupMatch> }) {
  const summary = [
    post.selling.length ? `Selling ${post.selling.length}` : null,
    post.buying.length ? `Buying ${post.buying.length}` : null,
    post.trading.length ? `Wants ${post.trading.length} in trade` : null,
  ].filter(Boolean);
  return (
    <li
      className={`rounded-lg border p-3 ${
        post.matchCount
          ? 'border-emerald-300 bg-white dark:border-emerald-800 dark:bg-gray-800'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm text-gray-900 dark:text-gray-100">
          <span className="font-semibold">{summary.join(' · ')}</span>
          {post.groupName && <span className="text-xs text-gray-500 dark:text-gray-400"> · {post.groupName}</span>}
          {post.matchCount > 0 && (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300"> · {post.matchCount} match{post.matchCount === 1 ? '' : 'es'} for you</span>
          )}
        </p>
        {post.postUrl && <PostLink url={post.postUrl} label={post.matchCount ? 'Open post to make an offer' : 'Open post'} />}
      </div>
      <Section title="Selling" items={post.selling} byListing={byListing} />
      <Section title="Buying" items={post.buying} byListing={byListing} />
      <Section title="Wanted in trade" items={post.trading} byListing={byListing} />
    </li>
  );
}
