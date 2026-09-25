// Small presentational pieces shared by the /feed views (by post, by card).
import { ExternalLink } from 'lucide-react';
import { FOILING_MAP } from '@/lib/fab-constants';
import { TcgAffiliateLink } from '@/components/tracking/TcgAffiliateLink';

export const PITCH_LABEL: Record<number, string> = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export const foilingName = (code: string | null) => (code ? (FOILING_MAP as Record<string, string>)[code] ?? null : null);

export function PostLink({ url, label = 'Post' }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
    >
      {label}<ExternalLink className="w-3 h-3" aria-hidden="true" />
      <span className="sr-only"> on Facebook (opens in a new tab)</span>
    </a>
  );
}

/** Affiliate "Buy on TCGplayer" link for the printing the TCG Low came from. */
export function BuyOnTcgplayer({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <TcgAffiliateLink
      tcgplayerUrl={url}
      feature="market_feed"
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      title="Buy on TCGplayer"
    >
      Buy on TCGplayer<ExternalLink className="w-3 h-3" aria-hidden="true" />
    </TcgAffiliateLink>
  );
}
