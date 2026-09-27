"use client";

// Side-by-side view of a ratio's two sides, above the deck: the cards counted
// on each side (main deck + equipment + inventory, as the counts), as tiles in
// the Cards view or as lists in the Table view. A single-measure ratio shows
// one column. Plain, no animation.

import { useMemo } from "react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { buildDeckTableRows, type DeckTableRow } from "@/lib/deck/deck-table";
import { measureLabel, measureMatches, ratioRow, type DeckRatio, type Measure } from "@/lib/deck/ratios";

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };
const ZONE: Record<string, string> = { maindeck: "Main deck", equipment: "Equipment", inventory: "Inventory" };

function Side({ measure, rows, style }: { measure: Measure; rows: DeckTableRow[]; style: "tiles" | "list" }) {
  const copies = rows.reduce((n, r) => n + r.qty, 0);
  const label = `${measureLabel(measure)} · ${copies} ${copies === 1 ? "copy" : "copies"}`;
  return (
    <div role="group" aria-label={label} className="min-w-0 flex-1 border border-gray-300 dark:border-gray-700">
      <h3 className="border-b border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">{label}</h3>
      {rows.length === 0 ? (
        <p className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">No cards.</p>
      ) : style === "tiles" ? (
        <ul className="flex flex-wrap gap-2 p-2">
          {rows.map(r => (
            <li key={r.key} className="w-[96px]">
              <div className="relative">
                <img src={r.details.image_url || "/cardback.webp"} alt={r.name} loading="lazy" className="w-full rounded-md" />
                <span className="absolute right-1 top-1 rounded-sm bg-black/75 px-1 text-[11px] font-semibold tabular-nums text-white">×{r.qty}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-gray-800 dark:text-gray-200" title={r.name}>{r.name}</p>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse text-sm text-gray-800 dark:text-gray-200">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <th scope="col" className="w-10 px-2 py-1 text-right font-medium">Qty</th>
              <th scope="col" className="px-2 py-1 font-medium">Name</th>
              <th scope="col" className="w-24 px-2 py-1 font-medium">Zone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-b border-gray-200 dark:border-gray-800">
                <td className="px-2 py-1 text-right tabular-nums">{r.qty}</td>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-1.5">
                    {r.pitch != null && <span className={`h-2 w-2 rounded-full ${PITCH_DOT[r.pitch] ?? "bg-gray-400"}`} aria-hidden />}
                    {r.name}
                  </span>
                </td>
                <td className="px-2 py-1">{ZONE[r.zone] ?? r.zone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function RatioCompare({ deck, ratio, style, onClose }: {
  deck: DeckDTO;
  ratio: DeckRatio;
  style: "tiles" | "list";
  onClose: () => void;
}) {
  // Same scope as the counts: main deck + equipment + inventory.
  const rows = useMemo(
    () => buildDeckTableRows(deck).filter(r => r.zone === "maindeck" || r.zone === "equipment" || r.zone === "inventory"),
    [deck],
  );
  const sides = [ratio.a, ...(ratio.b ? [ratio.b] : [])];
  const row = ratioRow(ratio, deck);
  const heading = `${row.label} — ${row.value}${row.note ? ` (${row.note})` : ""}`;

  return (
    <section aria-label={heading} className="mb-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
        <button type="button" onClick={onClose} aria-label="Close comparison" className="text-blue-700 underline hover:no-underline dark:text-blue-400">Close</button>
      </div>
      <div className="flex items-start gap-3">
        {sides.map((m, i) => (
          <Side key={i} measure={m} rows={rows.filter(r => measureMatches(r.details, m))} style={style} />
        ))}
      </div>
    </section>
  );
}
