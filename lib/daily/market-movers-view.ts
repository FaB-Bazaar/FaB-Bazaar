// Quick filters above the /daily "Around the market" list.

export type FoilingFilter = "all" | "nonfoil" | "foil";
export type MarketFilters = { minPrice: number; foiling: FoilingFilter };

export const NO_MARKET_FILTERS: MarketFilters = { minPrice: 0, foiling: "all" };

// Printing foiling codes that are NOT a foil ("s" standard; "n" legacy).
const NON_FOIL_CODES = new Set(["s", "n", ""]);

type Filterable = { foiling: string | null | undefined; pAtSignal: number | null | undefined };

export function filterMarketMovers<T extends Filterable>(rows: T[], filters: MarketFilters): T[] {
  if (filters.minPrice <= 0 && filters.foiling === "all") return rows;
  return rows.filter((r) => {
    if (filters.minPrice > 0 && (r.pAtSignal == null || r.pAtSignal < filters.minPrice)) return false;
    if (filters.foiling === "all") return true;
    const nonFoil = NON_FOIL_CODES.has((r.foiling ?? "").toLowerCase());
    return filters.foiling === "nonfoil" ? nonFoil : !nonFoil;
  });
}
