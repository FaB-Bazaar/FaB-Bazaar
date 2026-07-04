/**
 * Canonical PrintingsSearchFilters → /opt deep-link params (hybrid search,
 * Bridge A: "chat shows its work"). When an AI/MCP search runs, the tool emits
 * an /opt URL alongside the results; opening it hydrates the SAME filters as
 * editable chips (param names must match lib/search/opt-url-state.ts).
 *
 * Deliberately partial: only fields with a clean /opt chip equivalent are
 * mapped. Hero-legality expansions (heroClasses/heroTalents/heroEssences),
 * negation fields (setsNot, …), and boolean flag families have no chip
 * representation and are silently skipped — the link is a starting point for
 * manual refinement, not a lossless round-trip.
 *
 * Pure + framework-free.
 */

const csv = (a: unknown): string | null =>
  Array.isArray(a) && a.length > 0 ? a.map(String).join(',') : null;

const num = (v: unknown): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? String(v) : null;

export function filtersToOptParams(filters: Record<string, unknown>): URLSearchParams {
  const p = new URLSearchParams();

  // Query text: name search is /opt's default mode; text search sets mode=text.
  if (typeof filters.name === 'string' && filters.name.trim()) {
    p.set('q', filters.name.trim());
  } else if (typeof filters.text === 'string' && filters.text.trim()) {
    p.set('q', filters.text.trim());
    p.set('mode', 'text');
  }

  // /opt has a single-type chip; only an unambiguous single type maps.
  if (Array.isArray(filters.types) && filters.types.length === 1) {
    p.set('type', String(filters.types[0]));
  }

  const csvParams: Array<[string, unknown]> = [
    ['classes', filters.classes],
    ['talents', filters.talents],
    ['keywords', filters.keywords],
    ['rarities', filters.rarities],
    ['foilings', filters.foilings],
    ['editions', filters.editions],
    ['sets', filters.sets],
    ['heroAge', filters.heroAges],
  ];
  for (const [key, value] of csvParams) {
    const v = csv(value);
    if (v) p.set(key, v);
  }

  const pitch = num(filters.pitch);
  if (pitch) p.set('pitch', pitch);
  if (typeof filters.format === 'string' && filters.format) p.set('format', filters.format);

  const rangeParams: Array<[string, unknown]> = [
    ['costMin', filters.costMin], ['costMax', filters.costMax],
    ['powerMin', filters.powerMin], ['powerMax', filters.powerMax],
    ['defMin', filters.defenseMin], ['defMax', filters.defenseMax],
    ['priceMin', filters.priceMin], ['priceMax', filters.priceMax],
  ];
  for (const [key, value] of rangeParams) {
    const v = num(value);
    if (v) p.set(key, v);
  }

  return p;
}

/** Absolute /opt URL for the given filters; bare /opt when nothing maps. */
export function buildOptSearchUrl(filters: Record<string, unknown>, baseUrl: string): string {
  const params = filtersToOptParams(filters).toString();
  return `${baseUrl.replace(/\/$/, '')}/opt${params ? `?${params}` : ''}`;
}
