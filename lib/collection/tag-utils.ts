// lib/collection/tag-utils.ts
//
// Pure helpers for editing a binder's flat tag list inline on the collection
// page. Tags are owner-defined section labels; we dedupe case-insensitively so
// "Inventory" and "inventory" don't both appear, but preserve the casing the
// user first typed.

/**
 * Merge comma-separated `raw` input into `existing`, trimming each entry,
 * dropping blanks, and deduping case-insensitively. Existing tags and their
 * order are preserved; new tags are appended in input order.
 */
export function addTags(existing: string[], raw: string): string[] {
  const result = [...existing];
  for (const tag of raw.split(',').map(t => t.trim()).filter(Boolean)) {
    if (!result.some(t => t.toLowerCase() === tag.toLowerCase())) {
      result.push(tag);
    }
  }
  return result;
}

/** Remove `tag` from `existing`, matching case-insensitively. */
export function removeTag(existing: string[], tag: string): string[] {
  return existing.filter(t => t.toLowerCase() !== tag.toLowerCase());
}
