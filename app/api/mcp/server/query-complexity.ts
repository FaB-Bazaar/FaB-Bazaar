/**
 * Pre-execution guard on search_printings tool input.
 *
 * Recoverable problems are FIXED, not rejected: an over-limit `options.limit`
 * is clamped to MAX_SEARCH_LIMIT in place. Models routinely guess limit:200
 * when expecting a big result set, and a rejection burns a whole agent-loop
 * iteration on something the server can trivially correct. Only genuinely
 * unanswerable requests (unfiltered bulk pulls, absurd pages) still fail.
 */

export const MAX_SEARCH_LIMIT = 100;

export function validateQueryComplexity(toolInput: any): { isValid: boolean; error?: string } {
  const options = toolInput.options || {};

  if (options.limit > MAX_SEARCH_LIMIT) {
    options.limit = MAX_SEARCH_LIMIT;
  }

  // New schema: cards[] array — each entry carries its own filters/query
  if (toolInput.cards?.length > 0) {
    return { isValid: true };
  }

  // Legacy schema: top-level filters/query (backwards-compat path)
  const filters = toolInput.filters || {};

  if (filters.searchableText && filters.searchableText.length < 2) {
    return { isValid: false, error: "Search text must be at least 2 characters" };
  }

  const hasSpecificFilter = !!(
    filters.name || filters.sets?.length || filters.types?.length ||
    filters.classes?.length || filters.talents?.length || filters.rarities?.length ||
    filters.foilings?.length || filters.editions?.length || filters.color ||
    filters.collectorNumber || filters.printingIds || filters.cardUniqueId ||
    filters.cardUniqueIds || filters.text || filters.searchableText ||
    filters.heroLegal || filters.heroClasses?.length || filters.heroTalents?.length ||
    filters.format
  );
  const hasQuery = !!(toolInput.query?.trim());
  const effectiveLimit = options.limit || 12;

  if (!hasSpecificFilter && !hasQuery && effectiveLimit > 50) {
    return { isValid: false, error: "Large queries require at least one specific filter (name, set, type, talent, class, rarity, etc.)" };
  }
  if (options.page > 1000) {
    return { isValid: false, error: "Maximum page number is 1000" };
  }

  return { isValid: true };
}
