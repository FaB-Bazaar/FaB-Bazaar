"use client";

// Rail deck page Prices view: the deck's TCG Low value and cost to finish on
// top, then every card per zone as a sortable priced row (priciest first).
// The maths lives in lib/deck/deck-prices.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { deckPrices, sortPriceRows, PRICE_ZONE_LABEL, type PriceSort, type PriceSortKey } from "@/lib/deck/deck-prices";
import { cn } from "@/lib/utils";

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };

type Column = { key: PriceSortKey; label: string; align?: "right"; className?: string };
const BASE_COLUMNS: Column[] = [
  { key: "name", label: "Card" },
  { key: "zone", label: "Zone", className: "w-40" },
  { key: "qty", label: "Qty", align: "right", className: "w-14" },
  { key: "each", label: "Each", align: "right", className: "w-24" },
  { key: "total", label: "Total", align: "right", className: "w-24" },
];
const OWNED_COLUMNS: Column[] = [
  { key: "owned", label: "Own", align: "right", className: "w-14" },
  { key: "buy", label: "Buy", align: "right", className: "w-24" },
];

export default function PricesView({ deck, owned }: {
  deck: DeckDTO;
  /** card_unique_id → copies owned in any printing; null = unknown (signed out / loading). */
  owned: ReadonlyMap<string, { owned: number }> | null;
}) {
  const p = useMemo(() => deckPrices(deck, { owned }), [deck, owned]);
  const [sort, setSort] = useState<PriceSort>(null);
  const rows = useMemo(() => sortPriceRows(p.rows, sort), [p.rows, sort]);
  const columns = p.toFinish ? [...BASE_COLUMNS, ...OWNED_COLUMNS] : BASE_COLUMNS;
  const active: NonNullable<PriceSort> = sort ?? { key: "total", dir: "desc" };

  // Cycle per column: its natural order (A→Z for text, biggest first for
  // numbers) → reversed → back to the default (Total, biggest first).
  const clickHeader = (key: PriceSortKey) =>
    setSort(prev => {
      const first = key === "name" || key === "zone" ? "asc" : "desc";
      if (prev?.key !== key) return { key, dir: first };
      return prev.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : null;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3 text-sm text-gray-800 dark:text-gray-200">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Deck value</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100" data-testid="deck-value">{usd(p.total)}</p>
        </div>
        {p.toFinish && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cost to finish</p>
            <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100" data-testid="cost-to-finish">{usd(p.toFinish.value)}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {p.zones.map(z => (
            <span key={z.zone}>{z.label} <span className="tabular-nums font-medium">{usd(z.value)}</span></span>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        TCG Low for the printings in this deck.
        {p.toFinish && (p.toFinish.missingCopies === 0
          ? " You own every card in it."
          : ` Cost to finish: the ${p.toFinish.missingCopies} ${p.toFinish.missingCopies === 1 ? "copy" : "copies"} you don't own in any printing.`)}
        {p.unpricedCopies > 0 && ` ${p.unpricedCopies} ${p.unpricedCopies === 1 ? "copy has" : "copies have"} no price yet (counted as $0).`}
        {p.benchValue > 0 && ` Bench (${usd(p.benchValue)}) isn't counted.`}
      </p>

      <table aria-label="Deck prices" className="w-full border-collapse text-sm text-gray-800 dark:text-gray-200">
        <thead className="sticky top-16 z-10 bg-gray-100 dark:bg-gray-800">
          <tr className="border-b border-gray-300 dark:border-gray-700">
            {columns.map(c => {
              const sorted = active.key === c.key ? active.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                  className={cn("px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300", c.align === "right" ? "text-right" : "text-left", c.className)}
                >
                  <button type="button" onClick={() => clickHeader(c.key)} className="inline-flex items-center gap-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                    {c.label}
                    {sorted === "asc" && <ChevronUp className="h-3 w-3" aria-hidden />}
                    {sorted === "desc" && <ChevronDown className="h-3 w-3" aria-hidden />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60">
              <td className="px-2 py-1 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  {r.pitch != null && PITCH_DOT[r.pitch]
                    ? <span className={cn("h-2 w-2 shrink-0 rounded-full", PITCH_DOT[r.pitch])} aria-label={`Pitch ${r.pitch}`} />
                    : <span className="h-2 w-2 shrink-0" aria-hidden />}
                  {r.name}
                </span>
              </td>
              <td className="px-2 py-1">{PRICE_ZONE_LABEL[r.zone]}</td>
              <td className="px-2 py-1 text-right tabular-nums">{r.qty}</td>
              <td className="px-2 py-1 text-right tabular-nums">{r.each == null ? <span title="No price yet" className="text-gray-600 dark:text-gray-400">—</span> : usd(r.each)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{usd(r.total)}</td>
              {p.toFinish && (
                <>
                  <td className="px-2 py-1 text-right tabular-nums">{r.owned}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.buy ? usd(r.buy) : <span className="text-gray-600 dark:text-gray-400">—</span>}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="px-2 py-1.5" colSpan={4}>Total</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{usd(p.total)}</td>
            {p.toFinish && (
              <>
                <td />
                <td className="px-2 py-1.5 text-right tabular-nums">{usd(p.toFinish.value)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
