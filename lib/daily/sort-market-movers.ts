// Column sorting for the /daily "Around the market" table.
// Unsorted keeps the signal's own ranking; missing values always sort last.

import { SET_METADATA } from "@/lib/fab-constants/sets";

export type MarketSortKey = "name" | "set" | "price" | "change";
export type MarketSort = { key: MarketSortKey; dir: "asc" | "desc" } | null;

type Sortable = {
  displayName: string;
  set: string | null | undefined;
  pAtSignal: number | null | undefined;
  pctChange: number | null | undefined;
};

function releaseTime(set: string | null | undefined): number | null {
  const date = set ? (SET_METADATA as Record<string, { releaseDate?: string | null }>)[set.toLowerCase()]?.releaseDate : null;
  return date ? Date.parse(date) : null;
}

function value(row: Sortable, key: MarketSortKey): number | string | null {
  switch (key) {
    case "name": return row.displayName;
    case "set": return releaseTime(row.set);
    case "price": return row.pAtSignal ?? null;
    case "change": return row.pctChange ?? null;
  }
}

export function sortMarketMovers<T extends Sortable>(rows: T[], sort: MarketSort): T[] {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return cmp * sign;
  });
}
