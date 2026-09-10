// lib/scan/hash-plan.ts — decide which printing images the index builder fetches.
// Pure; the script (scripts/compute-image-hashes.ts) supplies the rows.

export interface HashPlanInput {
  printingId: string;
  imageUrl: string | null;
  set: string;
  language: string;
}

export interface HashPlanItem {
  imageUrl: string;
  /** Every printing sharing this exact render (foilings often do). */
  printingIds: string[];
}

export interface HashPlanOptions {
  /** Restrict to these set codes (any case). */
  sets?: string[];
  /** Re-hash even when the same image url is already indexed. */
  force?: boolean;
}

/**
 * @param rows     candidate printings (already filtered by language upstream)
 * @param hashed   printingId → image_url that was hashed previously
 */
export function planHashWork(rows: HashPlanInput[], hashed: Map<string, string>, opts: HashPlanOptions): HashPlanItem[] {
  const setFilter = opts.sets?.length ? new Set(opts.sets.map(s => s.toLowerCase())) : null;
  const byUrl = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.imageUrl) continue;
    if (setFilter && !setFilter.has(r.set.toLowerCase())) continue;
    if (!opts.force && hashed.get(r.printingId) === r.imageUrl) continue;
    const ids = byUrl.get(r.imageUrl) ?? [];
    ids.push(r.printingId);
    byUrl.set(r.imageUrl, ids);
  }
  return [...byUrl.entries()].map(([imageUrl, printingIds]) => ({ imageUrl, printingIds }));
}
