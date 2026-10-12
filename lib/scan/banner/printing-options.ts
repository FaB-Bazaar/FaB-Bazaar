// lib/scan/banner/printing-options.ts — a card's printings as short text lines (collector number, set, foiling,
// edition, language, price) so the /scan name box can offer them without loading every image. Price = tcg_low
// (CLAUDE.md: tcg_low is THE price). English first, then cheapest — the usual binder copy floats to the top.
import { getSetName, getFoilingName, getEditionName } from '@/lib/fab-formatters';

export interface PrintingLine {
  code: string; language: string; details: string[]; price: string;
  /** the words shown next to the foiling chip (components/shared/PrintingMetaChips): no foiling, Extended Art kept */
  detailsBesideChips: string[];
}

const priceOf = (p: any): number | null => { const n = Number(p?.tcg_low); return p?.tcg_low != null && Number.isFinite(n) ? n : null; };

export function printingLine(p: any): PrintingLine {
  const price = priceOf(p);
  const setName = getSetName(p.set) || String(p.set ?? '').toUpperCase();
  return {
    code: p.collector_number ?? '',
    language: String(p.language ?? 'en').toUpperCase(),
    details: [setName, getFoilingName(p.foiling, p.is_extended_art), getEditionName(p.edition)].filter(Boolean),
    detailsBesideChips: [setName, p.is_extended_art ? 'Extended Art' : '', getEditionName(p.edition)].filter(Boolean),
    price: price === null ? '—' : `$${price.toFixed(2)}`,
  };
}

export function orderPrintings<T>(printings: T[]): T[] {
  return [...printings].sort((a: any, b: any) => {
    const lang = Number((a.language ?? 'en') !== 'en') - Number((b.language ?? 'en') !== 'en');
    if (lang) return lang;
    const pa = priceOf(a), pb = priceOf(b);
    if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
    return pa - pb || String(a.language).localeCompare(String(b.language)) || String(a.collector_number).localeCompare(String(b.collector_number));
  });
}

/** The printing a scanned card starts on: the top of orderPrintings (English, cheapest) — a plain non-foil for most
 *  binder copies. /browse's selectDefaultPrinting suits decklists; on /scan it picked e.g. an EA Cold Foil for a $0.05 card. */
export function defaultScanPrinting<T>(printings: T[]): T | null {
  return printings.length ? orderPrintings(printings)[0] : null;
}
