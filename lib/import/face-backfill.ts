/**
 * Pairing logic for the legacy double-sided face backfill.
 *
 * fab-cube models a double-sided print as two sibling printing entries whose
 * image filenames differ only by a back marker:
 *   IAR159-MV.webp / IAR159-MV_BACK.webp   (modern)
 *   DYN092.png     / DYN092_Back.png       (Dynasty-era)
 *   UPR006.png     / UPR006_A_Back.png     (Uprising invocations)
 *
 * Pairing is GLOBAL by filename (not per-card): cross-card DFCs (Construct
 * Nitro Mechanoid // Nitro Mechanoid) put front and back on different cards.
 * Anything ambiguous or orphaned is reported, never guessed.
 */

export interface FaceEntry {
  uid: string; // fab-cube printing unique_id
  image: string; // full image URL
  /**
   * Optional disambiguator (e.g. 'set|collector|edition|foiling'): fab-cube
   * reuses one art file across foiling variants, so a bare filename match can
   * be ambiguous; candidates are narrowed to entries with the SAME key first.
   */
  key?: string;
}

export interface PairResult {
  pairs: Array<{ frontUid: string; backUid: string }>;
  /** back-marked entries whose front filename doesn't exist in the feed */
  orphans: string[];
  /** back-marked entries whose front filename matches more than one entry */
  ambiguous: string[];
}

const BACK_MARKER = /(_A)?_BACK(?=\.[a-z0-9]+$)/i;

function filenameOf(url: string): string {
  return url.split('/').pop() ?? url;
}

export function pairBackFaces(entries: FaceEntry[]): PairResult {
  const byFilename = new Map<string, FaceEntry[]>();
  for (const e of entries) {
    const fn = filenameOf(e.image);
    if (!byFilename.has(fn)) byFilename.set(fn, []);
    byFilename.get(fn)!.push(e);
  }

  const pairs: PairResult['pairs'] = [];
  const orphans: string[] = [];
  const ambiguous: string[] = [];

  for (const e of entries) {
    const fn = filenameOf(e.image);
    if (!BACK_MARKER.test(fn)) continue;
    const frontFn = fn.replace(BACK_MARKER, '');
    let fronts = byFilename.get(frontFn) ?? [];
    let backs = byFilename.get(fn) ?? [];
    if (fronts.length === 0) { orphans.push(e.uid); continue; }
    // Narrow same-image variant collisions by the attribute key.
    if ((fronts.length > 1 || backs.length > 1) && e.key) {
      fronts = fronts.filter((f) => f.key === e.key);
      backs = backs.filter((b) => b.key === e.key);
    }
    if (fronts.length !== 1 || backs.length > 1) { ambiguous.push(e.uid); continue; }
    pairs.push({ frontUid: fronts[0].uid, backUid: e.uid });
  }

  return { pairs, orphans, ambiguous };
}
