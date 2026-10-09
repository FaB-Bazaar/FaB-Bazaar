// app/daily/DailyMoversView.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Library, Search } from "lucide-react";
import { PrintingMetaChips, SetLogo } from "@/components/shared/PrintingMetaChips";
import { sortMarketMovers, type MarketSort, type MarketSortKey } from "@/lib/daily/sort-market-movers";
import { AffiliateDisclosure } from "@/components/shared/AffiliateDisclosure";
import { TcgAffiliateLink } from "@/components/tracking/TcgAffiliateLink";
import type {
  DailyMoverDTO,
  MarketMoverDTO,
  MarketMoversDTO,
  MoversInCollectionDTO,
  SignalType,
} from "@/lib/services/contracts/IDailyMoversService";

// ---------------------------------------------------------------------------
// Signal metadata
// ---------------------------------------------------------------------------

const SIGNAL_META: Record<
  SignalType,
  {
    title: string;
    blurb: string;
    /** Plain-words tag on a your-movers row. */
    tag: string;
    /** What the reference price is, in words: "$8.70 → $26.20 since yesterday". */
    window: string;
  }
> = {
  top_gainer: {
    title: "Top Gainers",
    blurb: "Biggest 24-hour price increases",
    tag: "Up 24h",
    window: "since yesterday",
  },
  breakout: {
    title: "Breakouts",
    blurb: "Cards crossing above their 30-day high",
    tag: "New 30-day high",
    window: "vs 30-day high",
  },
  steady_riser: {
    title: "Steady Risers",
    blurb: "Smooth 30-day uptrends — quiet accumulators",
    tag: "Steady 30-day rise",
    window: "over 30 days",
  },
  top_decliner: {
    title: "Top Decliners",
    blurb: "Biggest 24-hour drops",
    tag: "Down 24h",
    window: "since yesterday",
  },
};

const SECTION_ORDER: Array<{
  signal: SignalType;
  userKey: keyof Pick<MoversInCollectionDTO, "gainers" | "decliners" | "breakouts" | "steadyRisers">;
}> = [
  { signal: "top_gainer", userKey: "gainers" },
  { signal: "breakout", userKey: "breakouts" },
  { signal: "steady_riser", userKey: "steadyRisers" },
  { signal: "top_decliner", userKey: "decliners" },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  return `$${p.toFixed(2)}`;
}

function formatPctChange(p: number | null | undefined): string {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(Math.abs(p) >= 10 ? 0 : 1)}%`;
}

function formatImpact(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

/** "last night's prices · 2026-08-20" when fresh, plain "as of" when older. */
function dateLabel(asOfDate: string): string {
  if (!asOfDate) return "";
  const asOf = new Date(`${asOfDate}T00:00:00Z`).getTime();
  const ageDays = (Date.now() - asOf) / 86_400_000;
  return ageDays <= 2
    ? `last night's prices · ${asOfDate}`
    : `as of ${asOfDate}`;
}

function impactColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-rose-600 dark:text-rose-400";
  return "text-gray-600 dark:text-gray-400";
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

// Where you hold the card: binder(s), then decks — one deck is linked, several
// collapse to a count (the full list is in the tooltip) so it never dominates the row.
function HoldingLine({ m }: { m: MergedMover }) {
  const deckNames = m.decks.map((d) => d.deckName).join(", ");
  return (
    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
      {m.binders.map((b, i) => (
        <React.Fragment key={b.binderId}>
          {i > 0 && ", "}
          <Link href={`/binder/${b.binderId}`} className="hover:underline">
            {b.binderName}
          </Link>
        </React.Fragment>
      ))}
      {m.binders.length > 0 && (m.binders.length === 1 ? " binder" : " binders")}
      {m.decks.length === 1 && (
        <>
          {" · in "}
          <Link href={`/decks/${m.decks[0].publicId}`} className="hover:underline">
            {m.decks[0].deckName}
          </Link>
        </>
      )}
      {m.decks.length > 1 && <span title={deckNames}>{` · in ${m.decks.length} decks`}</span>}
    </div>
  );
}

// Compact buy link for the dense tiers (market grid, sparse-day rows). The
// full "Buy on TCGplayer" row stays on the large MoverCard tiles; here it is
// one small element under the price so the grid stays scannable. `feature`
// distinguishes the tier in the affiliate_click event (market_* / mover_compact_*).
function CompactBuyLink({ url, feature }: { url: string | null; feature: string }) {
  if (!url) return null;
  return (
    <TcgAffiliateLink
      tcgplayerUrl={url}
      feature={feature}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      title="Buy on TCGplayer"
    >
      <span>Buy</span>
      {/* Solid pill so the white CDN wordmark reads in light mode too */}
      <img
        src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
        alt="on TCGplayer"
        className="h-3 w-[74px] max-w-none"
      />
    </TcgAffiliateLink>
  );
}

// ---------------------------------------------------------------------------
// Your movers — one row per card: a card that hit several signals, or sits in
// several binders, is shown once with every signal tagged and every binder listed.
// ---------------------------------------------------------------------------

interface MergedMover extends DailyMoverDTO {
  signals: SignalType[];
  binders: Array<{ binderId: string; binderName: string }>;
}

function mergeMovers(data: MoversInCollectionDTO): MergedMover[] {
  const byPrinting = new Map<string, MergedMover>();
  for (const { userKey, signal } of SECTION_ORDER) {
    for (const m of data[userKey]) {
      const existing = byPrinting.get(m.printingId);
      if (!existing) {
        byPrinting.set(m.printingId, {
          ...m,
          signals: [signal],
          binders: m.binderName ? [{ binderId: m.binderId, binderName: m.binderName }] : [],
        });
        continue;
      }
      if (!existing.signals.includes(signal)) existing.signals.push(signal);
      // Rows come once per (printing, binder, signal): count a binder's copies once.
      if (m.binderName && !existing.binders.some((b) => b.binderId === m.binderId)) {
        existing.binders.push({ binderId: m.binderId, binderName: m.binderName });
        existing.quantity += m.quantity;
        existing.dollarImpact =
          existing.dollarImpact != null || m.dollarImpact != null
            ? (existing.dollarImpact ?? 0) + (m.dollarImpact ?? 0)
            : null;
      }
      for (const d of m.decks) {
        if (!existing.decks.some((e) => e.deckId === d.deckId)) existing.decks = [...existing.decks, d];
      }
    }
  }
  return [...byPrinting.values()].sort(
    (a, b) => Math.abs(b.dollarImpact ?? 0) - Math.abs(a.dollarImpact ?? 0)
  );
}

function MergedMoverRow({ m, featurePrefix }: { m: MergedMover; featurePrefix: string }) {
  const isUp = (m.dollarChange ?? 0) >= 0;
  return (
    <div data-testid="mover-row" className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 flex gap-3">
      <Link
        href={`/printing/${m.printingId}`}
        className="shrink-0 self-start w-14 sm:w-20 aspect-[63/88] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label={`View ${m.displayName}`}
      >
        {m.imageUrl ? (
          <Image src={m.imageUrl} alt={m.displayName} fill sizes="(max-width: 640px) 56px, 80px" className="object-cover" unoptimized />
        ) : null}
      </Link>

      {/* Text takes the width it needs; the set logo slot gets the rest. */}
      <div className="min-w-0 flex-1 sm:flex-none">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/printing/${m.printingId}`}
            className="font-medium text-gray-900 dark:text-gray-100 hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
          >
            {m.displayName}
          </Link>
          <div className="flex items-center gap-1.5">
            <SetLogo set={m.set} size="md" className="sm:hidden" />
            <PrintingMetaChips foiling={m.foiling} rarity={m.rarity} showSet={false} />
          </div>
        </div>
        <div className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {m.signals.map((s) => SIGNAL_META[s].tag).join(" · ")}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
          {formatPrice(m.refPrice)}
          {" → "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatPrice(m.pAtSignal)}</span>
          {` ${SIGNAL_META[m.signals[0]].window} `}
          <span className={isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            ({formatPctChange(m.pctChange)})
          </span>
        </div>
        <HoldingLine m={m} />
      </div>

      {/* The row's spare width: the set logo, as large as the space allows. */}
      <div className="hidden sm:flex relative flex-1 min-w-0 self-stretch items-center justify-center my-1 mx-2">
        <SetLogo set={m.set} size="fill" />
      </div>

      <div className="shrink-0 flex flex-col items-end text-right">
        {m.dollarImpact != null && (
          <div className={`text-lg font-semibold tabular-nums ${impactColor(m.dollarImpact)}`}>
            {formatImpact(m.dollarImpact)}
          </div>
        )}
        <div className="text-xs text-gray-600 dark:text-gray-400">
          your {m.quantity} {m.quantity === 1 ? "copy" : "copies"}
        </div>
        <div className="mt-auto pt-2">
          <CompactBuyLink url={m.tcgplayerUrl} feature={`${featurePrefix}${m.signals[0]}`} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market tier
// ---------------------------------------------------------------------------

const MARKET_PAGE_SIZE = 10;

function MarketRow({ m }: { m: MarketMoverDTO }) {
  const isPositive = (m.dollarChange ?? 0) >= 0;
  const href = `/printing/${m.printingId}`;
  return (
    <tr className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60">
      <td className="py-1.5 pl-3 pr-2 w-10">
        <Link
          href={href}
          className="block w-8 aspect-[63/88] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700"
          aria-label={`View ${m.displayName}`}
          tabIndex={-1}
        >
          {m.imageUrl ? (
            <Image src={m.imageUrl} alt={m.displayName} fill sizes="32px" className="object-cover" unoptimized />
          ) : null}
        </Link>
      </td>
      <td className="py-1.5 pr-3 sm:pr-4 max-w-0 w-full sm:max-w-none sm:w-auto whitespace-nowrap">
        <Link
          href={href}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block sm:max-w-[18rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
        >
          {m.displayName}
        </Link>
      </td>
      {/* Straight after the name; any spare width sits here, before the price. */}
      <td className="py-1.5 pr-3 hidden sm:table-cell sm:w-full">
        <PrintingMetaChips set={m.set} foiling={m.foiling} rarity={m.rarity} setSize="md" className="min-w-max" />
      </td>
      <td className="py-1.5 pr-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-gray-100">
        {formatPrice(m.pAtSignal)}
      </td>
      <td
        className={`py-1.5 pr-3 text-right text-sm tabular-nums whitespace-nowrap ${
          isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {formatPctChange(m.pctChange)}
      </td>
      <td className="py-1.5 pr-3 text-right whitespace-nowrap">
        <CompactBuyLink url={m.tcgplayerUrl} feature={`market_${m.signalType}`} />
      </td>
    </tr>
  );
}

function SortHeader({
  label, sortKey, sort, onSort, className = "",
}: {
  label: string;
  sortKey: MarketSortKey;
  sort: MarketSort;
  onSort: (key: MarketSortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`py-2 pr-3 font-medium ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm ${
          active ? "text-gray-900 dark:text-gray-100" : ""
        }`}
      >
        {label}
        <span aria-hidden="true" className={active ? "" : "invisible"}>
          {sort?.dir === "asc" ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );
}

// One signal at a time: tabs over a single compact table (the four stacked
// tile grids made "Around the market" most of the page).
function MarketMovers({ lists }: { lists: Array<{ signal: SignalType; movers: MarketMoverDTO[] }> }) {
  const available = lists.filter((l) => l.movers.length > 0);
  const [active, setActive] = React.useState<SignalType | null>(available[0]?.signal ?? null);
  const [expanded, setExpanded] = React.useState(false);
  // null = the signal's own ranking. First click on a column picks the useful
  // direction (highest price, biggest change, newest set, A→Z); a second reverses it.
  const [sort, setSort] = React.useState<MarketSort>(null);
  const current = available.find((l) => l.signal === active) ?? available[0];
  if (!current) return null;

  const onSort = (key: MarketSortKey) =>
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    );
  const sorted = sortMarketMovers(current.movers, sort);
  const rows = expanded ? sorted : sorted.slice(0, MARKET_PAGE_SIZE);
  const hidden = sorted.length - rows.length;

  return (
    <div>
      <div role="tablist" aria-label="Market signals" className="flex flex-wrap gap-1 mb-2">
        {available.map(({ signal, movers }) => {
          const selected = signal === current.signal;
          return (
            <button
              key={signal}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => { setActive(signal); setExpanded(false); setSort(null); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                selected
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              {SIGNAL_META[signal].title}
              <span className={`ml-1.5 tabular-nums ${selected ? "opacity-80" : "text-gray-500 dark:text-gray-400"}`}>
                {movers.length}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{SIGNAL_META[current.signal].blurb}</p>
      <div className="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="text-left text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80">
            <tr>
              <th scope="col" className="w-10"><span className="sr-only">Image</span></th>
              <SortHeader label="Card" sortKey="name" sort={sort} onSort={onSort} />
              <SortHeader label="Set" sortKey="set" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
              <SortHeader label="Price" sortKey="price" sort={sort} onSort={onSort} className="text-right" />
              <SortHeader label="Change" sortKey="change" sort={sort} onSort={onSort} className="text-right" />
              <th scope="col"><span className="sr-only">Buy</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <MarketRow key={`${m.signalType}-${m.printingId}`} m={m} />
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
        >
          Show {hidden} more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page view
// ---------------------------------------------------------------------------

export function DailyMoversView({
  signedIn,
  userMovers,
  market,
  error,
}: {
  signedIn: boolean;
  userMovers: MoversInCollectionDTO | null;
  market: MarketMoversDTO | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-rose-600 dark:text-rose-400 mb-2">
            Couldn’t load daily movers
          </h2>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  const asOfDate = userMovers?.asOfDate || market?.asOfDate || "";
  const ownedPrintingIds = new Set(
    userMovers
      ? SECTION_ORDER.flatMap(({ userKey }) => userMovers[userKey].map((m) => m.printingId))
      : []
  );

  // Affiliate-click feature names predate the merged list: quiet days were
  // "mover_compact_*", busy days "mover_*". Keep both so the analytics series continue.
  const sparse = userMovers != null && userMovers.totalCount > 0 && userMovers.totalCount < 6;
  const mergedMovers = userMovers ? mergeMovers(userMovers) : [];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <AffiliateDisclosure />
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daily Movers</h1>
          {signedIn && userMovers && (
            <p data-testid="movers-summary" className="mt-2 flex flex-wrap items-baseline gap-x-2 text-gray-700 dark:text-gray-300">
              <span className={`text-2xl font-bold tabular-nums ${impactColor(userMovers.totalImpact)}`}>
                {formatImpact(userMovers.totalImpact)}
              </span>
              {mergedMovers.length === 0
                ? "— none of your cards moved yesterday"
                : `across ${mergedMovers.length} card${mergedMovers.length === 1 ? "" : "s"} in your collection`}
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{dateLabel(asOfDate)}</p>
        </div>

        {/* Anonymous CTA */}
        {!signedIn && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200">
            These are yesterday’s biggest price moves across Flesh and Blood.{" "}
            <Link
              href={`/auth/login?callbackUrl=${encodeURIComponent("/daily")}`}
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Sign in
            </Link>{" "}
            to see which of <em>your</em> cards moved.
          </div>
        )}

        {/* Your movers tier */}
        {signedIn && userMovers && (
          <div className="mb-10">
            {userMovers.totalCount === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Quiet day for your cards — nothing you own hit the movers list. Here’s what moved
                  around the market instead.
                </p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link
                    href="/collection"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Library className="w-4 h-4" /> Your collection
                  </Link>
                  <Link
                    href="/opt"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Search className="w-4 h-4" /> Card search
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 xl:grid-cols-2">
                {mergedMovers.map((m) => (
                  <MergedMoverRow key={m.printingId} m={m} featurePrefix={sparse ? "mover_compact_" : "mover_"} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Market tier */}
        {market && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Around the market
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {signedIn
                  ? "All of yesterday’s signals across the game — cards you own are shown above."
                  : "All of yesterday’s signals across the game."}
              </p>
            </div>
            <MarketMovers
              lists={SECTION_ORDER.map(({ signal, userKey }) => ({
                signal,
                movers: market[userKey].filter((m) => !ownedPrintingIds.has(m.printingId)),
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
