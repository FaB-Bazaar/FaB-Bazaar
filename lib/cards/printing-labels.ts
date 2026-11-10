// Display names for a printing's set / foiling / edition / rarity, read from
// the compiled constants at call time (the set constants are live proxies —
// never copy them at module load). No request: don't reach for
// lib/metadata-service (`/api/metadata`) for these.

import {
  EDITION_MAP, FOILING_MAP, RARITY_MAP, SET_MAP,
  type EditionCode, type FoilingCode, type RarityCode, type SetCode,
} from "@/lib/fab-constants";

export function setLabel(code: string | null | undefined): string {
  if (!code) return "Unknown Set";
  return SET_MAP[code.toLowerCase() as SetCode] || SET_MAP[code.toUpperCase() as SetCode] || code.toUpperCase();
}

export function foilingLabel(code: string | null | undefined): string {
  if (!code) return "Non-foil";
  return FOILING_MAP[code.toLowerCase() as FoilingCode] || code;
}

export function editionLabel(code: string | null | undefined): string {
  if (!code) return "";
  return EDITION_MAP[code.toLowerCase() as EditionCode] || code;
}

export function rarityLabel(code: string | null | undefined): string {
  if (!code) return "";
  return RARITY_MAP[code.toLowerCase() as RarityCode] || code;
}
