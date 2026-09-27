"use client";

// Cards view companion to the Table's "Matches" group: while a highlight is
// active, the matching cards are shown as tiles ABOVE the deck, pushing the
// full (dimmed) deck down, so they're on screen instead of scattered across
// the sections below.

import { useMemo } from "react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { buildDeckTableRows, partitionByLens, sortDeckTableRows, ZONE_ORDER, type Lens, type TableZone } from "@/lib/deck/deck-table";

const ZONE_LABEL: Record<TableZone, string> = {
  hero: "Hero",
  equipment: "Equipment",
  maindeck: "Main deck",
  inventory: "Inventory",
  benched: "Bench",
};

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };

export default function MatchesStrip({ deck, active, onClear }: { deck: DeckDTO; active: Lens; onClear: () => void }) {
  const matches = useMemo(
    () => partitionByLens(sortDeckTableRows(buildDeckTableRows(deck), null), active).matches,
    [deck, active],
  );
  const copies = matches.reduce((s, r) => s + r.qty, 0);
  // One labelled group per zone, so inventory matches never mix into the main deck row.
  const byZone = ZONE_ORDER
    .map(zone => ({ zone, rows: matches.filter(r => r.zone === zone) }))
    .filter(g => g.rows.length > 0);
  const label = `Matches — ${matches.length} ${matches.length === 1 ? "card" : "cards"}, ${copies} ${copies === 1 ? "copy" : "copies"}`;

  return (
    <section aria-label={label} className="mb-4 border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-between border-b border-gray-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-amber-900/30 dark:text-gray-200">
        <span>{label}</span>
        <button type="button" onClick={onClear} className="font-normal text-blue-700 underline hover:no-underline dark:text-blue-400">Clear</button>
      </div>
      {matches.length === 0 ? (
        <p className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">No cards match.</p>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {byZone.map(({ zone, rows }) => {
          const groupLabel = `${ZONE_LABEL[zone]} · ${rows.reduce((n, r) => n + r.qty, 0)}`;
          return (
        <div key={zone} role="group" aria-label={groupLabel} className="px-3 py-2">
        <h3 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">{groupLabel}</h3>
        <ul className="flex flex-wrap gap-3">
          {rows.map(r => (
            <li key={r.key} className="w-[120px]">
              <div className="relative">
                <img
                  src={r.details.image_url || "/cardback.webp"}
                  alt={r.name}
                  loading="lazy"
                  className="w-full rounded-md"
                />
                <span className="absolute right-1 top-1 rounded-sm bg-black/75 px-1.5 text-xs font-semibold tabular-nums text-white">×{r.qty}</span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200" title={r.name}>
                {r.pitch != null && PITCH_DOT[r.pitch] && (
                  <span role="img" aria-label={`Pitch ${r.pitch}`} className={`h-2 w-2 flex-shrink-0 rounded-full ${PITCH_DOT[r.pitch]}`} />
                )}
                <span className="truncate">{r.name}</span>
              </p>
            </li>
          ))}
        </ul>
        </div>
          );
        })}
        </div>
      )}
    </section>
  );
}
