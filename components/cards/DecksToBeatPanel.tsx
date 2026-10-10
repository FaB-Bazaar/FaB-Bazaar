"use client";

/**
 * Card-details lightbox "Decks to Beat": the button lives in the pinned
 * footer, the panel at the bottom of the scroll body (a panel in the footer
 * squeezed the body until Printings vanished). The lightbox owns `open`.
 * Nothing is fetched until the panel mounts on the first click (the button
 * carries no count for that reason); one response fills both tabs — Decks (a
 * link per deck) and Meta (derived by lib/cards/decks-to-beat-meta). Mount
 * the panel with key={cardUniqueId} so ←/→ to another card resets it.
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ListOrdered, Loader2 } from "lucide-react";
import { getCardDecksToBeat } from "@/lib/client/decks-client";
import { metaFormats, ordinal, shortFormat, summarizeMeta } from "@/lib/cards/decks-to-beat-meta";
import type { CardDecksToBeatDTO, CardDecksToBeatEntryDTO } from "@/lib/services/contracts/IDeckService";
import { cn } from "@/lib/utils";

const INITIAL_ROWS = 5;

function monthYear(isoDate?: string): string | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function DeckRow({ deck }: { deck: CardDecksToBeatEntryDTO }) {
  const meta = [deck.eventName, monthYear(deck.eventDate), deck.format && shortFormat(deck.format)].filter(Boolean).join(" · ");
  return (
    <li>
      <Link
        href={`/decks/${deck.publicId}`}
        className="-mx-1 flex items-center justify-between gap-2 rounded px-1 py-1.5 hover:bg-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm text-gray-100">
            <span className="font-medium">{deck.heroName || deck.name}</span>
            {deck.placing != null && <span className="text-gray-400"> · {ordinal(deck.placing)}</span>}
          </span>
          {meta && <span className="block truncate text-[11px] text-gray-400">{meta}</span>}
        </span>
      </Link>
    </li>
  );
}

function MetaTab({ data }: { data: CardDecksToBeatDTO }) {
  const formats = metaFormats(data.decks);
  const [format, setFormat] = useState(formats[0]);
  if (!format) return <p className="mt-2 text-sm text-gray-300">No format information for these decks.</p>;
  const s = summarizeMeta(data.decks, data.totalsByFormat, format);
  const maxCount = s.heroes[0]?.count ?? 1;

  return (
    <div className="mt-2.5">
      {formats.length > 1 && (
        <div className="mb-2 inline-flex overflow-hidden rounded-md border border-gray-700 text-sm">
          {formats.map((f, i) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === format}
              onClick={() => setFormat(f)}
              className={cn("px-2.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400", i > 0 && "border-l border-gray-700", f === format ? "bg-gray-700 text-gray-100" : "text-gray-300 hover:bg-gray-800")}
            >
              {shortFormat(f)}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-center">
          <div className="text-sm font-semibold tabular-nums text-gray-100">{s.deckCount} / {s.total}</div>
          <div className="text-[11px] text-gray-300">{shortFormat(format)} decks</div>
        </div>
        <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-center">
          <div className="text-sm font-semibold tabular-nums text-gray-100">{s.heroes.length}</div>
          <div className="text-[11px] text-gray-300">{s.heroes.length === 1 ? "hero" : "heroes"}</div>
        </div>
        <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-center">
          <div className="text-sm font-semibold text-gray-100">{s.bestPlacing != null ? ordinal(s.bestPlacing) : "—"}</div>
          <div className="text-[11px] text-gray-300">best finish</div>
        </div>
      </div>
      <ul aria-label="Heroes" className="mt-2.5 space-y-1.5 text-sm">
        {s.heroes.map(h => (
          <li key={h.heroName} data-testid="meta-hero">
            <div className="flex justify-between gap-2">
              <span className="truncate text-gray-100">{h.heroName}</span>
              <span className="shrink-0 text-xs tabular-nums text-gray-400">{h.count}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded bg-gray-800">
              <div className="h-1.5 rounded bg-blue-400" style={{ width: `${(h.count / maxCount) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const decksToBeatPanelId = (cardUniqueId: string) => `decks-to-beat-${cardUniqueId}`;

export function DecksToBeatPanel({ cardUniqueId }: { cardUniqueId: string }) {
  const [data, setData] = useState<CardDecksToBeatDTO | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"decks" | "meta">("decks");
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const live = useRef(true);

  const load = () => {
    setError(false);
    getCardDecksToBeat(cardUniqueId).then(res => {
      if (!live.current) return;
      if (res.success) setData(res.data);
      else setError(true);
    });
  };

  // Mounted = opened: fetch (memoised per card in decksClient) and bring the
  // panel into view at the bottom of the scroll body. Re-arming `live` here
  // also survives StrictMode's mount→unmount→mount.
  useEffect(() => {
    live.current = true;
    load();
    ref.current?.scrollIntoView({ block: "nearest" });
    return () => { live.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (data || error) ref.current?.scrollIntoView({ block: "nearest" });
  }, [data, error]);

  const rows = data ? (showAll ? data.decks : data.decks.slice(0, INITIAL_ROWS)) : [];

  return (
    <div
      ref={ref}
      id={decksToBeatPanelId(cardUniqueId)}
      role="region"
      aria-label="Decks to Beat"
      className="mt-3 border-t border-gray-700 pt-3"
    >
      {error ? (
        <p className="text-sm text-gray-300">
          Couldn&apos;t load Decks to Beat.{" "}
          <button type="button" onClick={load} className="text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Retry</button>
        </p>
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading Decks to Beat…
        </p>
      ) : data.decks.length === 0 ? (
        <p className="text-sm text-gray-300">
          Not played in any Decks to Beat yet.
          <Link href="/decks/to-beat" className="mt-1 block text-sm text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Browse Decks to Beat</Link>
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Decks to Beat view" className="inline-flex overflow-hidden rounded-md border border-gray-700 text-sm">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "decks"}
              onClick={() => setTab("decks")}
              className={cn("px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400", tab === "decks" ? "bg-blue-500/15 text-blue-100" : "text-gray-300 hover:bg-gray-800")}
            >
              Decks <span className="text-gray-400">{data.decks.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "meta"}
              onClick={() => setTab("meta")}
              className={cn("border-l border-gray-700 px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400", tab === "meta" ? "bg-blue-500/15 text-blue-100" : "text-gray-300 hover:bg-gray-800")}
            >
              Meta
            </button>
          </div>
          {tab === "decks" ? (
            <>
              <ul aria-label="Decks to Beat playing this card" className="mt-2 divide-y divide-gray-800">
                {rows.map(d => <DeckRow key={d.publicId} deck={d} />)}
              </ul>
              {!showAll && data.decks.length > INITIAL_ROWS && (
                <button type="button" onClick={() => setShowAll(true)} className="mt-1 text-sm text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                  Show {data.decks.length - INITIAL_ROWS} more
                </button>
              )}
            </>
          ) : (
            <MetaTab data={data} />
          )}
        </>
      )}
    </div>
  );
}

export function DecksToBeatButton({ cardUniqueId, open, onToggle }: { cardUniqueId: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? decksToBeatPanelId(cardUniqueId) : undefined}
      onClick={onToggle}
      className={cn(
        "mb-2.5 flex w-full items-center justify-center rounded-lg border px-3 py-1.5 text-base text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        open ? "border-blue-400 bg-blue-500/10" : "border-gray-600 bg-gray-800/70 hover:bg-gray-700",
      )}
    >
      <ListOrdered className="mr-2 h-4 w-4" aria-hidden="true" />
      Decks to Beat
      <ChevronDown className={cn("ml-1.5 h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} aria-hidden="true" />
    </button>
  );
}
