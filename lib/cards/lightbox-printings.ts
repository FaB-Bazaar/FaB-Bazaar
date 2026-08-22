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
