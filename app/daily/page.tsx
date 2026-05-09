// app/daily/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Zap, LineChart } from "lucide-react";
import { dailyClient } from "@/lib/client";
import { FOILING_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants";
import { AffiliateDisclosure } from "@/components/shared/AffiliateDisclosure";
import { renderPurchaseLink } from "@/components/wants/utils";
import type {
  MoversInCollectionDTO,
  DailyMoverDTO,
} from "@/lib/services/contracts/IDailyMoversService";

const SECTIONS: Array<{
  key: keyof Pick<MoversInCollectionDTO, "gainers" | "decliners" | "breakouts" | "steadyRisers">;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    key: "gainers",
    title: "Top Gainers",
    blurb: "Biggest 24-hour price increases on cards you own",
    icon: TrendingUp,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "breakouts",
    title: "Breakouts",
    blurb: "Cards crossing above their 30-day high",
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "steadyRisers",
    title: "Steady Risers",
    blurb: "Smooth 30-day uptrends — quiet accumulators",
    icon: LineChart,
    accent: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "decliners",
    title: "Top Decliners",
    blurb: "Biggest 24-hour drops — review before selling",
    icon: TrendingDown,
    accent: "text-rose-600 dark:text-rose-400",
  },
];

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

function MoverCard({ m }: { m: DailyMoverDTO }) {
  const isPositive = (m.dollarChange ?? 0) >= 0;
  const setLabel = SET_MAP[m.set?.toLowerCase()] || m.set?.toUpperCase();
  const foilLabel = FOILING_MAP[m.foiling?.toLowerCase()] || m.foiling;
  const rarityLabel = RARITY_MAP[m.rarity?.toLowerCase()] || m.rarity?.toUpperCase();

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex gap-3">
      {/* Thumbnail */}
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

      {/* Body */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/printing/${m.printingId}`}
          className="font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
        >
          {m.displayName}
        </Link>
        <div className="flex flex-wrap gap-1 mt-1 text-xs">
          {setLabel && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300">
              {setLabel}
            </span>
          )}
          {foilLabel && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300">
              {foilLabel}
            </span>
          )}
          {rarityLabel && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300">
              {rarityLabel}
            </span>
          )}
        </div>

        {/* Prices and change */}
        <div className="mt-2 flex items-baseline gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400 line-through">{formatPrice(m.refPrice)}</span>
          <span className="text-gray-900 dark:text-gray-100 font-semibold">{formatPrice(m.pAtSignal)}</span>
          <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            ({formatPctChange(m.pctChange)})
          </span>
        </div>

        {/* Inventory context */}
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          You own <span className="font-medium text-gray-700 dark:text-gray-300">{m.quantity}</span>
          {m.binderName && (
            <> in <span className="font-medium text-gray-700 dark:text-gray-300">{m.binderName}</span></>
          )}
          {m.decks.length > 0 && (
            <>
              {" · "}
              In {m.decks.length} deck{m.decks.length === 1 ? "" : "s"}
            </>
          )}
        </div>

        {/* TCGplayer affiliate link */}
        {renderPurchaseLink(m.tcgplayerUrl ?? undefined, `mover_${m.signalType}`)}
      </div>
    </div>
  );
}

function MoverSection({
  title,
  blurb,
  icon: Icon,
  accent,
  movers,
}: {
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  movers: DailyMoverDTO[];
}) {
  if (movers.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${accent}`} />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">({movers.length})</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{blurb}</p>
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {movers.map((m) => (
          <MoverCard key={`${m.signalType}-${m.printingId}-${m.binderId}`} m={m} />
        ))}
      </div>
    </section>
  );
}

export default function DailyMoversPage() {
  const [data, setData] = useState<MoversInCollectionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await dailyClient.getMyMovers();
        if (cancelled) return;
        if (!result.success) {
          setError(result.error || "Failed to load daily movers");
          return;
        }
        setData(result.data!);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load daily movers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your movers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-rose-600 dark:text-rose-400 mb-2">
            Couldn’t load daily movers
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <AffiliateDisclosure />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Daily Movers in Your Collection
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {data.totalCount === 0
              ? "No cards in your collection moved today."
              : `${data.totalCount} of your cards moved`}
            {data.asOfDate ? ` · as of ${data.asOfDate}` : ""}
          </p>
        </div>

        {data.totalCount === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              Quiet day for your cards. Check back tomorrow.
            </p>
          </div>
        ) : (
          SECTIONS.map((s) => (
            <MoverSection
              key={s.key}
              title={s.title}
              blurb={s.blurb}
              icon={s.icon}
              accent={s.accent}
              movers={data[s.key]}
            />
          ))
        )}
      </div>
    </div>
  );
}
