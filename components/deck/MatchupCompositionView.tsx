// components/deck/MatchupCompositionView.tsx
"use client";

import React, { useMemo } from "react";
import type { CompositionEntry, Section } from "@/lib/utils/matchup-composition";
import { computeMatchupComposition } from "@/lib/utils/matchup-composition";

const PITCH_LABEL: Record<number, string> = { 1: "Red", 2: "Yellow", 3: "Blue" };
const PITCH_DOT: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-400",
  3: "bg-blue-500",
};

// Display order within each zone column. Hero first, then gear, then pitch buckets.
const SECTION_ORDER: Section[] = ["hero", "equipment", "red", "yellow", "blue", "unpitched"];
const SECTION_LABEL: Record<Section, string> = {
  hero: "Hero",
  equipment: "Equipment",
  red: "Red",
  yellow: "Yellow",
  blue: "Blue",
  unpitched: "Other",
};

function pitchFromSection(s: Section): number | null {
  if (s === "red") return 1;
  if (s === "yellow") return 2;
  if (s === "blue") return 3;
  return null;
}

function entryName(e: CompositionEntry): string {
  return (
    e.printing.printingDetails?.display_name ||
    e.printing.printingDetails?.name ||
    e.swapId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

interface MatchupCompositionViewProps {
  deck: any;
  swaps: { in: string[]; out: string[] };
  onHoverCard?: (imageUrl: string | null) => void;
}

export default function MatchupCompositionView({
  deck,
  swaps,
  onHoverCard,
}: MatchupCompositionViewProps) {
  const { main, inventory } = useMemo(
    () => computeMatchupComposition(deck, swaps),
    [deck, swaps]
  );

  const mainTotal = main.reduce((s, e) => s + e.qty, 0);
  // Hero is part of the registered list but not the library/equipment count
  // shown to players. Surface a (library + equipment) subtotal for readability.
  const mainPlayableTotal = main
    .filter((e) => e.section !== "hero")
    .reduce((s, e) => s + e.qty, 0);
  const invTotal = inventory.reduce((s, e) => s + e.qty, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <CompositionColumn
        title="Main + Equipment"
        subtitle={`${mainPlayableTotal} playable${mainTotal !== mainPlayableTotal ? ` · +1 hero` : ""}`}
        entries={main}
        onHoverCard={onHoverCard}
      />
      <CompositionColumn
        title="Inventory"
        subtitle={`${invTotal} card${invTotal === 1 ? "" : "s"}`}
        entries={inventory}
        onHoverCard={onHoverCard}
      />
    </div>
  );
}

function CompositionColumn({
  title,
  subtitle,
  entries,
  onHoverCard,
}: {
  title: string;
  subtitle: string;
  entries: CompositionEntry[];
  onHoverCard?: (imageUrl: string | null) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<Section, CompositionEntry[]>();
    for (const e of entries) {
      const list = map.get(e.section) ?? [];
      list.push(e);
      map.set(e.section, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => entryName(a).localeCompare(entryName(b)));
    }
    return map;
  }, [entries]);

  return (
    <div className="rounded-md border border-gray-700 bg-gray-950/70 p-2">
      <div className="flex items-baseline gap-2 px-1 pb-1.5 mb-1.5 border-b border-gray-700">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-100">{title}</h3>
        <span className="ml-auto text-xs text-gray-300">{subtitle}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-300 italic px-1 py-2">No cards.</p>
      ) : (
        <div className="space-y-2">
          {SECTION_ORDER.filter((s) => grouped.has(s)).map((section) => {
            const list = grouped.get(section)!;
            const sectionTotal = list.reduce((s, e) => s + e.qty, 0);
            return (
              <div key={section}>
                <div className="flex items-center gap-1.5 px-1 py-0.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    {SECTION_LABEL[section]}
                  </h4>
                  <span className="text-xs text-gray-400 tabular-nums">({sectionTotal})</span>
                </div>
                <ul className="space-y-1">
                  {list.map((e) => {
                    const pitch = pitchFromSection(e.section);
                    const img = e.printing.printingDetails?.image_url;
                    return (
                      <li
                        key={e.swapId}
                        className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-900/60"
                        onMouseEnter={() => img && onHoverCard?.(img)}
                        onMouseLeave={() => onHoverCard?.(null)}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
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
                        {pitch && (
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${PITCH_DOT[pitch]}`}
                            aria-label={`${PITCH_LABEL[pitch]} pitch`}
                            title={PITCH_LABEL[pitch]}
                          />
                        )}
                        <span
                          className="text-sm text-gray-100 truncate flex-1"
                          title={entryName(e)}
                        >
                          {entryName(e)}
                        </span>
                        <span className="text-sm font-bold text-gray-100 shrink-0 tabular-nums">
                          ×{e.qty}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
