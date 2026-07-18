/**
 * Pure decision logic for the API-based CardVault capture
 * (scripts/capture-cardvault.ts): which card slugs to fetch for an input
 * query, and the capture filename for each payload — kept byte-compatible
 * with the legacy browser-intercept capture conventions.
 */
// Manual transliteration map for characters NFKD doesn't decompose
// (mirrors the legacy capture script's behavior).
const TRANSLIT: Record<string, string> = {
  "ð": "d", "Ð": "D", "þ": "th", "Þ": "Th",
  "æ": "ae", "Æ": "Ae", "œ": "oe", "Œ": "Oe",
  "ø": "o", "Ø": "O", "ß": "ss",
};

function transliterate(s: string): string {
  const nfkd = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return Array.from(nfkd).map((c) => TRANSLIT[c] ?? c).join("");
}

/** CardVault's canonical card slug for a display name. */
export function slugifyCardName(name: string): string {
  return transliterate(name)
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Which card slugs to fetch for a query, given advanced-search results.
 * By-collector: ALL distinct slugs (double-sided promos share a collector —
 * the legacy browser capture clicked only the first tile and missed the
 * partner card). By-name: exact slug match when present, else all distinct.
 */
export function pickSlugs(
  query: string,
  byCollector: boolean,
  results: Array<{ card_id: string }>,
): string[] {
  const distinct = [...new Set(results.map((r) => r.card_id).filter(Boolean))];
  if (byCollector) return distinct;
  const exact = distinct.find((s) => s === slugifyCardName(query));
  return exact ? [exact] : distinct;
}

/**
 * Capture filename for the i-th slug of a query. First slug keeps the legacy
 * name (<collector>.json / <slug>.json) so existing tooling and skip-if-exists
 * behavior are unchanged; extra slugs (multi-card collectors) get a suffix.
 */
export function captureFilename(
  query: string,
  byCollector: boolean,
  slug: string,
  index: number,
): string {
  const base = byCollector ? query.toLowerCase() : slugifyCardName(query);
  return index === 0 ? `${base}.json` : `${base}--${slug}.json`;
}
