"use client";

// Rail deck page Prices view: the deck's TCG Low value and cost to finish on
// top, then every card per zone as a sortable priced row (priciest first).
// "Compare printings" adds what each line would cost in every finish
// (cheapest English printing, fetched on first use). The maths lives in
// lib/deck/deck-prices.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import {
  deckPrices, finishColumns, sortPriceRows, FINISH_LABEL, PRICE_ZONE_LABEL,
  type FinishPrices, type PriceSort, type PriceSortKey,
} from "@/lib/deck/deck-prices";
import { decksClient } from "@/lib/client";
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

export default function PricesView({ deckId, deck, owned }: {
  deckId: string;
  deck: DeckDTO;
  /** card_unique_id → copies owned in any printing; null = unknown (signed out / loading). */
  owned: ReadonlyMap<string, { owned: number }> | null;
}) {
  const p = useMemo(() => deckPrices(deck, { owned }), [deck, owned]);
  const [sort, setSort] = useState<PriceSort>(null);
  const rows = useMemo(() => sortPriceRows(p.rows, sort), [p.rows, sort]);
  const columns = p.toFinish ? [...BASE_COLUMNS, ...OWNED_COLUMNS] : BASE_COLUMNS;
  const active: NonNullable<PriceSort> = sort ?? { key: "total", dir: "desc" };
  const [preview, setPreview] = useState<{ url: string; x: number; y: number } | null>(null);

  // Compare printings: fetched once, on first use.
  const [compare, setCompare] = useState(false);
  const [finishPrices, setFinishPrices] = useState<FinishPrices | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const toggleCompare = async () => {
    const next = !compare;
    setCompare(next);
    if (!next || finishPrices) return;
    setFinishError(null);
    const res = await decksClient.getPrintingPrices(deckId);
    if (res.success) setFinishPrices(res.data.byCard);
    else setFinishError(res.error || "Couldn't load printing prices.");
  };
  const fc = useMemo(() => (compare && finishPrices ? finishColumns(p.rows, finishPrices) : null), [compare, finishPrices, p.rows]);

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

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={compare}
          onClick={toggleCompare}
          className={cn(
            "rounded-sm border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            compare
              ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200"
              : "border-gray-400 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
          )}
        >
          {compare && "✓ "}Compare printings
        </button>
        {compare && !finishPrices && !finishError && <span className="text-xs text-gray-600 dark:text-gray-400">Loading printing prices…</span>}
        {compare && finishError && <span role="alert" className="text-xs text-red-700 dark:text-red-300">{finishError}</span>}
        {fc && <span className="text-xs text-gray-600 dark:text-gray-400">Each finish column: the line at the cheapest English printing in that finish.</span>}
      </div>

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
            {fc?.finishes.map(f => (
              <th key={f} scope="col" className="w-24 px-2 py-1.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{FINISH_LABEL[f]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60">
              <td
                className="px-2 py-1 font-medium"
                onMouseMove={e => r.imageUrl && setPreview({ url: r.imageUrl, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setPreview(null)}
              >
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
              {fc?.finishes.map(f => {
                const v = fc.cells.get(r.key)?.[f] ?? null;
                return (
                  <td key={f} className="px-2 py-1 text-right tabular-nums" title={v != null && r.qty > 1 ? `${usd(v / r.qty)} each` : undefined}>
                    {v == null ? <span title={`No ${FINISH_LABEL[f].toLowerCase()} printing with a price`} className="text-gray-600 dark:text-gray-400">—</span> : usd(v)}
                  </td>
                );
              })}
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
            {fc?.finishes.map(f => (
              <td key={f} className="px-2 py-1.5 text-right tabular-nums">
                {usd(fc.totals[f].value)}
                {fc.totals[f].missingCopies > 0 && (
                  <span className="block text-xs font-normal text-gray-600 dark:text-gray-400">{fc.totals[f].missingCopies} not in this finish</span>
                )}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {preview && (
        <img
          src={preview.url}
          alt=""
          aria-hidden
          data-testid="price-preview"
          className="pointer-events-none fixed z-50 w-56 rounded-lg shadow-2xl"
          style={{
            left: Math.min(preview.x + 24, (typeof window !== "undefined" ? window.innerWidth : 1600) - 240),
            top: Math.max(72, Math.min(preview.y - 150, (typeof window !== "undefined" ? window.innerHeight : 900) - 320)),
          }}
        />
      )}
    </div>
  );
}
