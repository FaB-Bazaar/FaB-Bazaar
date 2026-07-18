/**
 * Default-printing picker for "the user didn't choose a printing" surfaces
 * (mobile deck-search drawer preselection, quick-add fallbacks).
 *
 * English printings always outrank foreign ones — a cheap ja/de/fr printing
 * must never be the silent default. Within a language tier, cheapest priced
 * printing wins; unpriced pools fall back to input order (callers pass
 * sortPrintings()-ordered lists, so index 0 is already canonical).
 */

interface PrintingLike {
  printing_id?: string;
  language?: string;
  tcgMarket?: string | number | null;
  [key: string]: unknown;
}

function cheapest<T extends PrintingLike>(printings: T[]): T | null {
  return printings
    .filter((p) => p.tcgMarket != null && !isNaN(Number(p.tcgMarket)))
    .reduce<T | null>(
      (min, p) => (min === null || Number(p.tcgMarket) < Number(min.tcgMarket) ? p : min),
      null
    );
}

export function pickDefaultPrinting<T extends PrintingLike>(printings: T[]): T | null {
  if (printings.length === 0) return null;
  // Rows predating the language column count as English ('en' is the DB default)
  const english = printings.filter((p) => (p.language ?? 'en') === 'en');
  if (english.length > 0) return cheapest(english) ?? english[0];
  return cheapest(printings) ?? printings[0];
}
