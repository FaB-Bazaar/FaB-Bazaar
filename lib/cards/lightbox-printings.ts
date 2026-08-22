/**
 * "Printings & prices" rows for the card-details lightbox: English printings
 * of one card in canonical order, labelled for display, priced with tcg_low
 * (THE price — never tcg_market).
 */

import {
  sortPrintings, getSetMetadata, SET_MAP, RARITY_MAP, FOILING_MAP, EDITION_MAP, ART_VARIATIONS_MAP,
} from '@/lib/fab-constants';

export interface LightboxPrintingInput {
  printing_id: string;
  collector_number?: string;
  set?: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  language?: string | null;
  art_variations?: string[] | null;
  tcg_low?: number | null;
  tcgplayer_url?: string | null;
  [key: string]: unknown;
}

export interface LightboxPrintingRow {
  printing_id: string;
  collector: string;
  setCode: string;
  setName: string;
  rarity: string;
  /** Raw foiling code ('s' | 'r' | 'c' | 'g' …) for badge styling. */
  foilCode: string;
  foiling: string;
  edition: string;
  artVariation: string | null;
  year: string | null;
  price: number | null;
  isCurrent: boolean;
  tcgplayerUrl: string | null;
}

const label = (map: Record<string, string>, code: string | undefined): string =>
  code ? map[code.toLowerCase()] ?? code.toUpperCase() : '';

export function buildPrintingRows(
  printings: LightboxPrintingInput[],
  currentPrintingId: string,
): { rows: LightboxPrintingRow[]; otherLanguages: number } {
  const english = printings.filter((p) => !p.language || p.language === 'en');
  const otherLanguages = printings.length - english.length;

  const rows = sortPrintings(english).map((p): LightboxPrintingRow => {
    const setCode = (p.set || '').toLowerCase();
    const releaseDate = getSetMetadata(setCode)?.releaseDate;
    const av = (p.art_variations ?? [])[0];
    return {
      printing_id: p.printing_id,
      collector: p.collector_number || setCode.toUpperCase() || '—',
      setCode,
      setName: (SET_MAP as Record<string, string>)[setCode] ?? setCode.toUpperCase(),
      rarity: label(RARITY_MAP as Record<string, string>, p.rarity),
      foilCode: (p.foiling || 's').toLowerCase(),
      foiling: label(FOILING_MAP as Record<string, string>, p.foiling),
      edition: label(EDITION_MAP as Record<string, string>, p.edition),
      artVariation: av ? label(ART_VARIATIONS_MAP as Record<string, string>, av) : null,
      year: releaseDate ? releaseDate.slice(0, 4) : null,
      price: typeof p.tcg_low === 'number' ? p.tcg_low : null,
      isCurrent: p.printing_id === currentPrintingId,
      tcgplayerUrl: p.tcgplayer_url || null,
    };
  });

  return { rows, otherLanguages };
}

// ─── Grouped view: one row per physical card (collector × edition × art), foilings as variants ──

export interface PrintingVariant {
  printing_id: string;
  foilCode: string;
  foiling: string;
  price: number | null;
  isCurrent: boolean;
  /** Lowest tcg_low across every variant of the card (ties: first in order). */
  isCheapest: boolean;
  tcgplayerUrl: string | null;
}

export interface PrintingGroup {
  key: string;
  collector: string;
  setCode: string;
  setName: string;
  rarity: string;
  edition: string;
  artVariation: string | null;
  year: string | null;
  variants: PrintingVariant[];
}

export function groupPrintingRows(rows: LightboxPrintingRow[]): PrintingGroup[] {
  const groups = new Map<string, PrintingGroup>();
  for (const r of rows) {
    const key = [r.setCode, r.collector, r.edition, r.artVariation ?? ''].join('|');
    let g = groups.get(key);
    if (!g) {
      g = {
        key, collector: r.collector, setCode: r.setCode, setName: r.setName, rarity: r.rarity,
        edition: r.edition, artVariation: r.artVariation, year: r.year, variants: [],
      };
      groups.set(key, g);
    }
    g.variants.push({
      printing_id: r.printing_id, foilCode: r.foilCode, foiling: r.foiling, price: r.price,
      isCurrent: r.isCurrent, isCheapest: false, tcgplayerUrl: r.tcgplayerUrl,
    });
  }

  const all = Array.from(groups.values());
  let cheapest: PrintingVariant | null = null;
  for (const g of all) for (const v of g.variants) {
    if (v.price != null && v.price > 0 && (cheapest === null || v.price < cheapest.price!)) cheapest = v;
  }
  if (cheapest) cheapest.isCheapest = true;
  return all;
}
