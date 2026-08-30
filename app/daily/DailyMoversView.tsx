// app/daily/DailyMoversView.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Zap, LineChart, Library, Search } from "lucide-react";
import { FOILING_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants";
import { AffiliateDisclosure } from "@/components/shared/AffiliateDisclosure";
import { renderPurchaseLink } from "@/components/wants/utils";
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
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    badgeClass: string;
  }
> = {
  top_gainer: {
    title: "Top Gainers",
    blurb: "Biggest 24-hour price increases",
    badge: "Gainer",
    icon: TrendingUp,
    accent: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300",
  },
  breakout: {
    title: "Breakouts",
    blurb: "Cards crossing above their 30-day high",
    badge: "Breakout",
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
  },
  steady_riser: {
    title: "Steady Risers",
    blurb: "Smooth 30-day uptrends — quiet accumulators",
    badge: "Riser",
    icon: LineChart,
    accent: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",
  },
  top_decliner: {
    title: "Top Decliners",
    blurb: "Biggest 24-hour drops",
    badge: "Decliner",
    icon: TrendingDown,
    accent: "text-rose-600 dark:text-rose-400",
    badgeClass: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300",
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

const MARKET_PREVIEW_COUNT = 8;

// Constants maps are keyed literal objects — widen for lookup by arbitrary code.
const lookup = (map: Record<string, string>, key: string | undefined | null): string | undefined =>
  key ? map[key.toLowerCase()] : undefined;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  if (p >= 100) return `$${p.toFixed(0)}`;
  if (p >= 10) return `$${p.toFixed(1)}`;
  return `$${p.toFixed(2)}`;
}

function formatPctChange(p: number | null | undefined): string {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
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

function CardTags({ m }: { m: Pick<DailyMoverDTO, "set" | "foiling" | "rarity"> }) {
  const setLabel = lookup(SET_MAP, m.set) || m.set?.toUpperCase();
  const foilLabel = lookup(FOILING_MAP, m.foiling) || m.foiling;
  const rarityLabel = lookup(RARITY_MAP, m.rarity) || m.rarity?.toUpperCase();
  return (
    <div className="flex flex-wrap gap-1 mt-1 text-xs">
      {[setLabel, foilLabel, rarityLabel].filter(Boolean).map((label, i) => (
        <span
          key={i}
          className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function PriceLine({ m }: { m: Pick<DailyMoverDTO, "refPrice" | "pAtSignal" | "pctChange" | "dollarChange"> }) {
  const isPositive = (m.dollarChange ?? 0) >= 0;
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-gray-600 dark:text-gray-400 line-through">{formatPrice(m.refPrice)}</span>
      <span className="text-gray-900 dark:text-gray-100 font-semibold">{formatPrice(m.pAtSignal)}</span>
      <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
        ({formatPctChange(m.pctChange)})
      </span>
    </div>
  );
}

function DeckLinks({ m }: { m: DailyMoverDTO }) {
  if (m.decks.length === 0) return null;
  const shown = m.decks.slice(0, 2);
  const more = m.decks.length - shown.length;
  return (
    <span>
      {" · In "}
      {shown.map((d, i) => (
        <React.Fragment key={d.deckId}>
          {i > 0 && ", "}
          <Link
            href={`/decks/${d.publicId}`}
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {d.deckName}
          </Link>
        </React.Fragment>
      ))}
      {more > 0 && ` +${more} more`}
    </span>
  );
}

function OwnershipLine({ m }: { m: DailyMoverDTO }) {
  return (
    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
      {m.dollarImpact != null && (
        <span className={`font-semibold ${impactColor(m.dollarImpact)}`}>
          {formatImpact(m.dollarImpact)}
        </span>
      )}
      {m.dollarImpact != null && " on "}
      your <span className="font-medium text-gray-700 dark:text-gray-300">{m.quantity}</span>
      {m.quantity === 1 ? " copy" : " copies"}
      {m.binderName && (
        <>
          {" in "}
          <Link
            href={`/binder/${m.binderId}`}
            className="font-medium text-gray-700 dark:text-gray-300 hover:underline"
          >
            {m.binderName}
          </Link>
        </>
      )}
      <DeckLinks m={m} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your movers — full tile (used when there's enough volume for sections)
// ---------------------------------------------------------------------------

function MoverCard({ m }: { m: DailyMoverDTO }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 flex gap-3">
      <Link
        href={`/printing/${m.printingId}`}
        className="shrink-0 w-24 sm:w-28 aspect-[63/88] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label={`View ${m.displayName}`}
      >
        {m.imageUrl ? (
          <Image
            src={m.imageUrl}
            alt={m.displayName}
            fill
            sizes="(max-width: 640px) 96px, 112px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/printing/${m.printingId}`}
          className="font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
        >
          {m.displayName}
        </Link>
        <CardTags m={m} />
        <div className="mt-2">
          <PriceLine m={m} />
        </div>
        <OwnershipLine m={m} />
        {renderPurchaseLink(m.tcgplayerUrl ?? undefined, `mover_${m.signalType}`, false, "Buy on TCGplayer")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your movers — compact merged row (used on sparse days)
// ---------------------------------------------------------------------------

interface MergedMover extends DailyMoverDTO {
  signals: SignalType[];
}

function mergeSparseMovers(data: MoversInCollectionDTO): MergedMover[] {
  const byKey = new Map<string, MergedMover>();
  for (const { userKey, signal } of SECTION_ORDER) {
    for (const m of data[userKey]) {
      const key = `${m.printingId}-${m.binderId}`;
      const existing = byKey.get(key);
      if (existing) existing.signals.push(signal);
      else byKey.set(key, { ...m, signals: [signal] });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => Math.abs(b.dollarImpact ?? 0) - Math.abs(a.dollarImpact ?? 0)
  );
}

function MergedMoverRow({ m }: { m: MergedMover }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 flex gap-3 items-center">
      <Link
        href={`/printing/${m.printingId}`}
        className="shrink-0 w-14 aspect-[63/88] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label={`View ${m.displayName}`}
      >
        {m.imageUrl ? (
          <Image src={m.imageUrl} alt={m.displayName} fill sizes="56px" className="object-cover" unoptimized />
        ) : null}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/printing/${m.printingId}`}
            className="font-medium text-gray-900 dark:text-gray-100 hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
          >
            {m.displayName}
          </Link>
          {m.signals.map((s) => (
            <span key={s} className={`px-1.5 py-0.5 rounded text-xs font-medium ${SIGNAL_META[s].badgeClass}`}>
              {SIGNAL_META[s].badge}
            </span>
          ))}
        </div>
        <CardTags m={m} />
        <OwnershipLine m={m} />
      </div>

      <div className="shrink-0 text-right">
        <PriceLine m={m} />
        {m.dollarImpact != null && (
          <div className={`text-sm font-semibold mt-1 ${impactColor(m.dollarImpact)}`}>
            {formatImpact(m.dollarImpact)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market tier
// ---------------------------------------------------------------------------

function MarketMoverTile({ m }: { m: MarketMoverDTO }) {
  const isPositive = (m.dollarChange ?? 0) >= 0;
  return (
    <Link
      href={`/printing/${m.printingId}`}
      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 flex gap-2 items-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div className="shrink-0 w-10 aspect-[63/88] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
        {m.imageUrl ? (
          <Image src={m.imageUrl} alt={m.displayName} fill sizes="40px" className="object-cover" unoptimized />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.displayName}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {lookup(SET_MAP, m.set) || m.set?.toUpperCase()}
          {" · "}
          {lookup(FOILING_MAP, m.foiling) || m.foiling}
        </div>
      </div>
      <div className="shrink-0 text-right text-sm">
        <div className="font-semibold text-gray-900 dark:text-gray-100">{formatPrice(m.pAtSignal)}</div>
        <div className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
          {formatPctChange(m.pctChange)}
        </div>
      </div>
    </Link>
  );
}

function MarketSection({ signal, movers }: { signal: SignalType; movers: MarketMoverDTO[] }) {
  if (movers.length === 0) return null;
  const meta = SIGNAL_META[signal];
  const Icon = meta.icon;
  const preview = movers.slice(0, MARKET_PREVIEW_COUNT);
  const rest = movers.slice(MARKET_PREVIEW_COUNT);

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${meta.accent}`} />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{meta.title}</h3>
        <span className="text-sm text-gray-600 dark:text-gray-400">({movers.length})</span>
        <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">— {meta.blurb}</span>
      </div>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {preview.map((m) => (
          <MarketMoverTile key={`${m.signalType}-${m.printingId}`} m={m} />
        ))}
      </div>
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Show {rest.length} more
          </summary>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 mt-2">
            {rest.map((m) => (
              <MarketMoverTile key={`${m.signalType}-${m.printingId}`} m={m} />
            ))}
          </div>
        </details>
      )}
    </section>
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

  const sparse = userMovers != null && userMovers.totalCount > 0 && userMovers.totalCount < 6;
  const mergedMovers = sparse && userMovers ? mergeSparseMovers(userMovers) : [];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <AffiliateDisclosure />
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daily Movers</h1>
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
            {/* Hero stat */}
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4 sm:p-5 mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`text-3xl font-bold ${impactColor(userMovers.totalImpact)}`}>
                {formatImpact(userMovers.totalImpact)}
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                {userMovers.totalCount === 0
                  ? "— none of your cards moved yesterday"
                  : `across ${userMovers.totalCount} mover${userMovers.totalCount === 1 ? "" : "s"} in your collection`}
              </span>
            </div>

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
            ) : sparse ? (
              <div className="grid gap-2 xl:grid-cols-2">
                {mergedMovers.map((m) => (
                  <MergedMoverRow key={`${m.printingId}-${m.binderId}`} m={m} />
                ))}
              </div>
            ) : (
              SECTION_ORDER.map(({ signal, userKey }) => {
                const movers = userMovers[userKey];
                if (movers.length === 0) return null;
                const meta = SIGNAL_META[signal];
                const Icon = meta.icon;
                return (
                  <section key={signal} className="mb-8">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-5 h-5 ${meta.accent}`} />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {meta.title}
                      </h2>
                      <span className="text-sm text-gray-600 dark:text-gray-400">({movers.length})</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {meta.blurb} on cards you own
                    </p>
                    <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {movers.map((m) => (
                        <MoverCard key={`${m.signalType}-${m.printingId}-${m.binderId}`} m={m} />
                      ))}
                    </div>
                  </section>
                );
              })
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
            {SECTION_ORDER.map(({ signal, userKey }) => (
              <MarketSection
                key={signal}
                signal={signal}
                movers={market[userKey].filter((m) => !ownedPrintingIds.has(m.printingId))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
