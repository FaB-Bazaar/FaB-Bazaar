/**
 * Which old printing_id-keyed Cloudflare images are safe to delete after the
 * deterministic-image-id migration.
 *
 * The Cloudflare account is SHARED with other apps (playmats, article assets,
 * avatars, unrelated projects), so deletion is strictly allowlist-based:
 * candidates are printing_ids whose row's image_url moved off that id, and
 * anything still referenced by any keep-list survives. Never diff against the
 * account inventory.
 */
export function computeOrphanDeletions(
  candidates: string[],
  keepLists: string[][],
): string[] {
  const keep = new Set(keepLists.flat());
  return [...new Set(candidates)].filter((id) => !keep.has(id));
}
