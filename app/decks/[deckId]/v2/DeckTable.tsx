"use client";

// Deck v2 Table view: the whole deck as one spreadsheet, one row per card per
// zone. With a highlight active the matching rows are lifted into a "Matches"
// group directly under the header, so the reader never scans for them.

import { Fragment, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import type { DeckCategory, DeckDTO } from "@/lib/services/contracts/IDeckService";
import {
  buildDeckTableRows, partitionByLens, sortDeckTableRows,
  type DeckTableRow, type Lens, type TableSort, type TableSortKey, type TableZone,
} from "@/lib/deck/deck-table";
import { cn } from "@/lib/utils";

const ZONE_LABEL: Record<TableZone, string> = {
  hero: "Hero",
  equipment: "Equipment",
  maindeck: "Main deck",
  inventory: "Sideboard",
  benched: "Maybe pile",
};

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };

const COLUMNS: Array<{ key: TableSortKey; label: string; align?: "right"; className?: string }> = [
  { key: "qty", label: "Qty", align: "right", className: "w-16" },
  { key: "name", label: "Name" },
  { key: "pitch", label: "Pitch", className: "w-14" },
  { key: "cost", label: "Cost", align: "right", className: "w-12" },
  { key: "power", label: "Pow", align: "right", className: "w-12" },
  { key: "defense", label: "Def", align: "right", className: "w-12" },
  { key: "type", label: "Type", className: "w-[32%]" },
  { key: "zone", label: "Zone", className: "w-28" },
];

type OwnershipEntry = { owned: number; needed: number };

export default function DeckTable({ deck, active, ownershipMap, canEdit, onChangeQty }: {
  deck: DeckDTO;
  active: Lens | null;
  ownershipMap: Map<string, OwnershipEntry>;
  canEdit: boolean;
  onChangeQty: (printingId: string, zone: DeckCategory, delta: 1 | -1) => void;
}) {
  const [sort, setSort] = useState<TableSort>(null);
  const [preview, setPreview] = useState<{ url: string; x: number; y: number } | null>(null);

  const rows = useMemo(() => sortDeckTableRows(buildDeckTableRows(deck), sort), [deck, sort]);
  const showOwned = ownershipMap.size > 0;
  const colCount = COLUMNS.length + (showOwned ? 1 : 0);

  // Groups shown, in order. With a highlight: Matches, then everything else.
  // Without one: zone groups when unsorted, one flat list when sorted by a column.
  const groups: Array<{ label: string; rows: DeckTableRow[]; dim?: boolean; match?: boolean }> = useMemo(() => {
    if (active) {
      const { matches, rest } = partitionByLens(rows, active);
      const copies = matches.reduce((s, r) => s + r.qty, 0);
      return [
        { label: `Matches — ${matches.length} ${matches.length === 1 ? "card" : "cards"}, ${copies} ${copies === 1 ? "copy" : "copies"}`, rows: matches, match: true },
        { label: "Other cards", rows: rest, dim: true },
      ];
    }
    if (sort) return [{ label: "", rows }];
    return (Object.keys(ZONE_LABEL) as TableZone[])
      .map(zone => {
        const zr = rows.filter(r => r.zone === zone);
        return { label: `${ZONE_LABEL[zone]} · ${zr.reduce((s, r) => s + r.qty, 0)}`, rows: zr };
      })
      .filter(g => g.rows.length > 0);
  }, [rows, active, sort]);

  const clickHeader = (key: TableSortKey) =>
    setSort(prev => (prev?.key !== key ? { key, dir: "asc" } : prev.dir === "asc" ? { key, dir: "desc" } : null));

  const owned = (r: DeckTableRow) =>
    Math.min(r.qty, r.printingIds.reduce((s, id) => s + (ownershipMap.get(id)?.owned ?? 0), 0));

  return (
    <>
      <table aria-label="Deck cards" className="w-full border-collapse text-sm text-gray-800 dark:text-gray-200">
        <thead className="sticky top-16 z-10 bg-gray-100 dark:bg-gray-900">
          <tr className="border-b border-gray-300 dark:border-gray-700">
            {COLUMNS.map(c => {
              const sorted = sort?.key === c.key ? sort.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                  className={cn("px-2 py-1.5 font-semibold text-xs text-gray-700 dark:text-gray-300", c.align === "right" ? "text-right" : "text-left", c.className)}
                >
                  <button type="button" onClick={() => clickHeader(c.key)} className="inline-flex items-center gap-0.5 hover:underline">
                    {c.label}
                    {sorted === "asc" && <ChevronUp className="h-3 w-3" aria-hidden />}
                    {sorted === "desc" && <ChevronDown className="h-3 w-3" aria-hidden />}
                  </button>
                </th>
              );
            })}
            {showOwned && <th scope="col" className="w-16 px-2 py-1.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Owned</th>}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.label || "all"}>
              {g.label && (
                <tr className={cn("border-b border-gray-300 dark:border-gray-700", g.match ? "bg-amber-100 dark:bg-amber-900/30" : "bg-gray-50 dark:bg-gray-900/60")}>
                  <th scope="rowgroup" colSpan={colCount} className="px-2 py-1 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{g.label}</th>
                </tr>
              )}
              {g.match && g.rows.length === 0 && (
                <tr><td colSpan={colCount} className="px-2 py-2 text-gray-600 dark:text-gray-400">No cards match.</td></tr>
              )}
              {g.rows.map(r => {
                const own = owned(r);
                return (
                  <tr
                    key={r.key}
                    data-row="card"
                    data-match={active ? String(!!g.match) : undefined}
                    className={cn("group border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60", g.dim && "text-gray-500 dark:text-gray-500")}
                  >
                    <td className="px-2 py-1 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {canEdit && (
                          <span className="invisible inline-flex group-hover:visible group-focus-within:visible">
                            <button type="button" aria-label={`Remove a copy of ${r.name}`} onClick={() => onChangeQty(r.printingIds[0], r.zone, -1)} className="rounded-sm px-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"><Minus className="h-3 w-3" /></button>
                            <button type="button" aria-label={`Add a copy of ${r.name}`} onClick={() => onChangeQty(r.printingIds[0], r.zone, 1)} className="rounded-sm px-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"><Plus className="h-3 w-3" /></button>
                          </span>
                        )}
                        {r.qty}
                      </span>
                    </td>
                    <td
                      className="px-2 py-1 font-medium"
                      onMouseMove={e => r.details.image_url && setPreview({ url: r.details.image_url, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setPreview(null)}
                    >
                      {r.name}
                    </td>
                    <td className="px-2 py-1">
                      {r.pitch != null && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-2.5 w-2.5 rounded-full", PITCH_DOT[r.pitch] ?? "bg-gray-400", g.dim && "opacity-50")} aria-hidden />
                          <span className="tabular-nums">{r.pitch}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.cost ?? ""}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.power ?? ""}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.defense ?? ""}</td>
                    <td className="truncate px-2 py-1 max-w-0" title={r.typeText}>{r.typeText}</td>
                    <td className="px-2 py-1">{ZONE_LABEL[r.zone]}</td>
                    {showOwned && (
                      <td className="px-2 py-1 text-right tabular-nums">
                        {own >= r.qty
                          ? <Check className="ml-auto h-3.5 w-3.5 text-green-600 dark:text-green-500" aria-label="All copies owned" />
                          : `${own}/${r.qty}`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Card image follows the cursor over a name — a table has no art otherwise. */}
      {preview && (
        <img
          src={preview.url}
          alt=""
          aria-hidden
          className="pointer-events-none fixed z-50 w-56 rounded-lg shadow-2xl"
          style={{
            left: Math.min(preview.x + 24, (typeof window !== "undefined" ? window.innerWidth : 1600) - 240),
            top: Math.max(72, Math.min(preview.y - 150, (typeof window !== "undefined" ? window.innerHeight : 900) - 320)),
          }}
        />
      )}
    </>
  );
}
