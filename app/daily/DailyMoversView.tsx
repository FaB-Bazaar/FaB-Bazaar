// app/daily/DailyMoversView.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Library, Search } from "lucide-react";
import { PrintingMetaChips, SetLogo } from "@/components/shared/PrintingMetaChips";
import { sortMarketMovers, type MarketSort } from "@/lib/daily/sort-market-movers";
import {
  filterMarketMovers,
  NO_MARKET_FILTERS,
  type FoilingFilter,
  type MarketFilters,
} from "@/lib/daily/market-movers-view";
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
    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 break-words">
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
function CompactBuyLink({
  url, feature, wordmarkFromSm = false,
}: {
  url: string | null;
  feature: string;
  /** Phones show just "Buy" (the market table has no room for the wordmark). */
  wordmarkFromSm?: boolean;
}) {
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
        className={`h-3 w-[74px] max-w-none ${wordmarkFromSm ? "hidden sm:block" : ""}`}
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
            className="min-w-0 max-w-full break-words sm:truncate font-medium text-gray-900 dark:text-gray-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
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

// Divisible by 1, 2 and 3, so the last row of the grid is never ragged.
const MARKET_PAGE_SIZE = 12;

const PRICE_FLOORS: Array<{ label: string; minPrice: number }> = [
  { label: "Any price", minPrice: 0 },
  { label: "$5+", minPrice: 5 },
  { label: "$20+", minPrice: 20 },
  { label: "$100+", minPrice: 100 },
];

const FOILING_FILTERS: Array<{ label: string; foiling: FoilingFilter }> = [
  { label: "Any finish", foiling: "all" },
  { label: "Non-foil", foiling: "nonfoil" },
  { label: "Foil", foiling: "foil" },
];

// Large card shown beside a hovered thumbnail. Fixed-positioned so it is never
// clipped by a row, and desktop-only.
const PREVIEW_WIDTH = 260;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 88) / 63);

interface CardPreview {
  url: string;
  name: string;
  top: number;
  left: number;
}

function previewFor(el: HTMLElement, url: string, name: string): CardPreview {
  const rect = el.getBoundingClientRect();
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const centred = rect.top + rect.height / 2 - PREVIEW_HEIGHT / 2;
  const top = Math.max(8, Math.min(centred, Math.max(8, viewportHeight - PREVIEW_HEIGHT - 8)));
  return { url, name, top, left: rect.right + 12 };
}

// One market mover, spelled out in words: was → now, then the change.
function MarketRow({ m, onPreview }: { m: MarketMoverDTO; onPreview: (preview: CardPreview | null) => void }) {
  const router = useRouter();
  const isPositive = (m.dollarChange ?? 0) >= 0;
  const href = `/printing/${m.printingId}`;
  return (
    <div
      data-testid="market-row"
      // The whole row opens the printing; links and buttons inside keep their own action.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
      className="flex items-center gap-3 p-2.5 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
    >
      <Link
        href={href}
        className="shrink-0 block w-12 aspect-[63/88] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700"
        aria-label={`View ${m.displayName}`}
        tabIndex={-1}
        onMouseEnter={(e) => {
          if (m.imageUrl) onPreview(previewFor(e.currentTarget, m.imageUrl, m.displayName));
        }}
        onMouseLeave={() => onPreview(null)}
      >
        {m.imageUrl ? (
          <Image src={m.imageUrl} alt={m.displayName} fill sizes="48px" className="object-cover" unoptimized />
        ) : null}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={href}
            className="min-w-0 max-w-full break-words text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
          >
            {m.displayName}
          </Link>
          <div className="flex items-center gap-1.5">
            {/* Phones have no room for the logo slot, so the logo sits here instead. */}
            <SetLogo set={m.set} size="md" className="sm:hidden" />
            <PrintingMetaChips foiling={m.foiling} rarity={m.rarity} showSet={false} />
          </div>
        </div>
        <div className="mt-1 text-sm tabular-nums text-gray-600 dark:text-gray-400">
          {formatPrice(m.refPrice)}
          {" → "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatPrice(m.pAtSignal)}</span>
        </div>
        <div
          className={`text-sm font-semibold tabular-nums ${
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatPctChange(m.pctChange)}
          {m.dollarChange != null && <span className="font-normal">{` (${formatImpact(m.dollarChange)})`}</span>}
        </div>
      </div>
      {/* The set logo, large, between the prices and the buy button. */}
      <div data-testid="market-set-logo" className="hidden sm:flex shrink-0 relative w-28 h-12 items-center justify-center">
        <SetLogo set={m.set} size="fill" />
      </div>
      <div className="shrink-0">
        <CompactBuyLink url={m.tcgplayerUrl} feature={`market_${m.signalType}`} wordmarkFromSm />
      </div>
    </div>
  );
}

function FilterChip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full border text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        pressed
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      {label}
    </button>
  );
}

type MarketSortChoice = "default" | "change" | "price-desc" | "price-asc" | "set" | "name";

const SORT_CHOICES: Array<{ value: MarketSortChoice; label: string }> = [
  { value: "default", label: "Default order" },
  { value: "change", label: "Biggest % change" },
  { value: "price-desc", label: "Highest price" },
  { value: "price-asc", label: "Lowest price" },
  { value: "set", label: "Newest set" },
  { value: "name", label: "Name A–Z" },
];

// "Default order" keeps the signal's own ranking. "Biggest % change" means the
// biggest drop on the decliners tab, so it sorts the other way there.
function toMarketSort(choice: MarketSortChoice, signal: SignalType): MarketSort {
  switch (choice) {
    case "default": return null;
    case "change": return { key: "change", dir: signal === "top_decliner" ? "asc" : "desc" };
    case "price-desc": return { key: "price", dir: "desc" };
    case "price-asc": return { key: "price", dir: "asc" };
    case "set": return { key: "set", dir: "desc" };
    case "name": return { key: "name", dir: "asc" };
  }
}

// One signal at a time: tabs over a single list (the four stacked tile grids
// made "Around the market" most of the page). Rows sit in columns on wide
// screens so the width is used by cards, not by a gap inside each row.
function MarketMovers({ lists }: { lists: Array<{ signal: SignalType; movers: MarketMoverDTO[] }> }) {
  const available = lists.filter((l) => l.movers.length > 0);
  const [active, setActive] = React.useState<SignalType | null>(available[0]?.signal ?? null);
  const [expanded, setExpanded] = React.useState(false);
  const [sortChoice, setSortChoice] = React.useState<MarketSortChoice>("default");
  // Filters stay put across tabs: "$20+" is a statement about what you care about.
  const [filters, setFilters] = React.useState<MarketFilters>(NO_MARKET_FILTERS);
  const [preview, setPreview] = React.useState<CardPreview | null>(null);
  // The preview is pinned to where the thumbnail was; drop it once the page moves.
  React.useEffect(() => {
    if (!preview) return;
    const clear = () => setPreview(null);
    window.addEventListener("scroll", clear, { passive: true });
    return () => window.removeEventListener("scroll", clear);
  }, [preview]);
  const current = available.find((l) => l.signal === active) ?? available[0];
  if (!current) return null;

  const matching = filterMarketMovers(current.movers, filters);
  const sorted = sortMarketMovers(matching, toMarketSort(sortChoice, current.signal));
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
              onClick={() => { setActive(signal); setExpanded(false); setSortChoice("default"); }}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          Sort by
          <select
            value={sortChoice}
            onChange={(e) => setSortChoice(e.target.value as MarketSortChoice)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs py-1 pl-2 pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {SORT_CHOICES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Minimum price" className="flex flex-wrap gap-1">
          {PRICE_FLOORS.map(({ label, minPrice }) => (
            <FilterChip
              key={label}
              label={label}
              pressed={filters.minPrice === minPrice}
              onClick={() => { setFilters((f) => ({ ...f, minPrice })); setExpanded(false); }}
            />
          ))}
        </div>
        <div role="group" aria-label="Finish" className="flex flex-wrap gap-1">
          {FOILING_FILTERS.map(({ label, foiling }) => (
            <FilterChip
              key={label}
              label={label}
              pressed={filters.foiling === foiling}
              onClick={() => { setFilters((f) => ({ ...f, foiling })); setExpanded(false); }}
            />
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          No cards match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
          {rows.map((m) => (
            <MarketRow key={`${m.signalType}-${m.printingId}`} m={m} onPreview={setPreview} />
          ))}
        </div>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
        >
          Show {hidden} more
        </button>
      )}
      {preview && (
        <div
          data-testid="card-preview"
          aria-hidden="true"
          style={{ top: preview.top, left: preview.left, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
          className="hidden md:block fixed z-50 pointer-events-none rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/20 bg-gray-100 dark:bg-gray-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="" className="h-full w-full object-cover" />
        </div>
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
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
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
