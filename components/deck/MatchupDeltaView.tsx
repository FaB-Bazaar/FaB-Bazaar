// components/deck/MatchupDeltaView.tsx
"use client";

import React, { useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toTalisharIdentifier } from "@/lib/utils";
import type { Swaps } from "@/lib/utils/matchup-delta";

interface PrintingLike {
  printingDetails?: {
    name?: string;
    display_name?: string;
    image_url?: string;
    pitch?: number | { $numberInt: string };
  };
}

interface CardEntry {
  talisharId: string;
  name: string;
  imageUrl?: string;
  pitch: number | null;
  count: number;
}

const PITCH_LABEL: Record<number, string> = { 1: "Red", 2: "Yellow", 3: "Blue" };
const PITCH_DOT: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-400",
  3: "bg-blue-500",
};

function getPitch(p: PrintingLike): number | null {
  const pv = p.printingDetails?.pitch;
  if (typeof pv === "number") return pv;
  if (pv && typeof pv === "object" && "$numberInt" in pv) return parseInt(pv.$numberInt, 10);
  return null;
}

function buildTalisharId(p: PrintingLike): string {
  const cardName = p.printingDetails?.name || "";
  const baseId = toTalisharIdentifier(cardName);
  if (!baseId) return "";
  const pitch = getPitch(p);
  const suffix: Record<number, string> = { 1: "red", 2: "yellow", 3: "blue" };
  return pitch && suffix[pitch] ? `${baseId}_${suffix[pitch]}` : baseId;
}

function buildPrintingIndex(deck: any): Map<string, PrintingLike> {
  const idx = new Map<string, PrintingLike>();
  const sources: any[] = [
    ...(deck?.hero || []),
    ...(deck?.equipment || []),
    ...(deck?.maindeck || []),
    ...(deck?.inventory || []),
  ];
  for (const p of sources) {
    const id = buildTalisharId(p);
    if (id && !idx.has(id)) idx.set(id, p);
  }
  return idx;
}

function aggregate(ids: string[], idx: Map<string, PrintingLike>): CardEntry[] {
  const groups = new Map<string, CardEntry>();
  for (const id of ids) {
    const existing = groups.get(id);
    if (existing) {
      existing.count++;
      continue;
    }
    const printing = idx.get(id);
    const name = printing?.printingDetails?.display_name
      || printing?.printingDetails?.name
      || id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    groups.set(id, {
      talisharId: id,
      name,
      imageUrl: printing?.printingDetails?.image_url,
      pitch: printing ? getPitch(printing) : null,
      count: 1,
    });
  }
  return [...groups.values()].sort((a, b) => {
    const pa = a.pitch ?? 99;
    const pb = b.pitch ?? 99;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

interface MatchupDeltaViewProps {
  deck: any;
  delta: Swaps;
  baselineLabel?: string;
  onHoverCard?: (imageUrl: string | null) => void;
}

export default function MatchupDeltaView({ deck, delta, baselineLabel, onHoverCard }: MatchupDeltaViewProps) {
  const idx = useMemo(() => buildPrintingIndex(deck), [deck]);
  const ins = useMemo(() => aggregate(delta.in, idx), [delta.in, idx]);
  const outs = useMemo(() => aggregate(delta.out, idx), [delta.out, idx]);

  if (ins.length === 0 && outs.length === 0) {
    return (
      <div className="text-sm text-gray-300 italic px-1 py-2">
        No changes from {baselineLabel ?? "the base decklist"} for this matchup.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <DeltaColumn
        kind="in"
        title="In"
        cards={ins}
        empty={`No additions${baselineLabel ? ` vs ${baselineLabel}` : ""}.`}
        onHoverCard={onHoverCard}
      />
      <DeltaColumn
        kind="out"
        title="Out"
        cards={outs}
        empty={`No removals${baselineLabel ? ` vs ${baselineLabel}` : ""}.`}
        onHoverCard={onHoverCard}
      />
    </div>
  );
}

function DeltaColumn({
  kind,
  title,
  cards,
  empty,
  onHoverCard,
}: {
  kind: "in" | "out";
  title: string;
  cards: CardEntry[];
  empty: string;
  onHoverCard?: (imageUrl: string | null) => void;
}) {
  const isIn = kind === "in";
  const Icon = isIn ? ArrowUp : ArrowDown;
  const accent = isIn ? "text-emerald-300 border-emerald-400/40" : "text-rose-300 border-rose-400/40";
  const total = cards.reduce((s, c) => s + c.count, 0);
  return (
    <div className={`rounded-md border bg-gray-950/70 p-2 ${accent}`}>
      <div className="flex items-center gap-2 px-1 pb-1.5 mb-1.5 border-b border-current/30">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
        <span className="ml-auto text-xs font-semibold text-gray-200">
          {isIn ? "+" : "−"}
          {total}
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="text-xs text-gray-300 italic px-1 py-2">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {cards.map((c) => (
            <li
              key={c.talisharId}
              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-900/60"
              onMouseEnter={() => c.imageUrl && onHoverCard?.(c.imageUrl)}
              onMouseLeave={() => onHoverCard?.(null)}
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt=""
                  className="w-8 h-11 object-cover object-top rounded shrink-0 border border-gray-700"
                  loading="lazy"
                />
              ) : (
                <div
                  className="w-8 h-11 rounded shrink-0 border border-gray-700 bg-gray-800 flex items-center justify-center text-xs text-gray-300"
                  aria-hidden="true"
                >
                  ?
                </div>
              )}
              {c.pitch && (
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${PITCH_DOT[c.pitch] ?? "bg-gray-500"}`}
                  aria-label={`${PITCH_LABEL[c.pitch] ?? "Unpitched"} pitch`}
                  title={PITCH_LABEL[c.pitch] ?? ""}
                />
              )}
              <span className="text-sm text-gray-100 truncate flex-1" title={c.name}>
                {c.name}
              </span>
              <span className="text-sm font-bold text-gray-100 shrink-0 tabular-nums">×{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
