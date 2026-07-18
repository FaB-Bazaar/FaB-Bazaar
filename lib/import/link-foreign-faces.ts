/**
 * Post-insert pass: mirror English DFC face linkage onto foreign-language
 * printings — is_front_face and other_face_printing_id.
 *
 * import-i18n.ts mirrors each foreign row from an English counterpart, but a
 * face pair can't be linked at insert time (the partner row may not exist
 * yet), so foreign rows historically landed with the column defaults
 * (is_front_face=true, no link). This pass repairs both fields from the
 * English rows' own linkage. Idempotent; never modifies English rows.
 */
import type { Pool } from "pg";

export interface LinkForeignFacesResult {
  facesFlagged: number;
  pairsLinked: number;
}

export async function linkForeignFaces(pool: Pool): Promise<LinkForeignFacesResult> {
  // Pass 1a — authoritative per-face source: the LSS print code carries a
  // _BACK marker (e.g. FR_IAR106-MV_BACK). Where present, it beats any
  // mirror-based inference — required for DFCs whose two faces share one
  // card_unique_id and are otherwise indistinguishable.
  const flaggedByCode = await pool.query(
    `UPDATE printings
        SET is_front_face = (lss_print_code NOT LIKE '%\\_BACK')
      WHERE language <> 'en'
        AND lss_print_code IS NOT NULL
        AND is_front_face IS DISTINCT FROM (lss_print_code NOT LIKE '%\\_BACK')`,
  );

  // Pass 1b — mirror-based: a foreign row mirrors its English counterpart on
  // (card_unique_id, set, collector_number, foiling, edition) — the key
  // import-i18n.ts matches on. Only applied where every English row for the
  // key agrees on is_front_face (same-card DFCs have mixed values there and
  // are covered by pass 1a or left untouched).
  const flaggedByMirror = await pool.query(
    `UPDATE printings f
        SET is_front_face = e.is_front_face
       FROM printings e
      WHERE f.language <> 'en'
        AND e.language = 'en'
        AND e.card_unique_id = f.card_unique_id
        AND e.set = f.set
        AND e.collector_number = f.collector_number
        AND e.foiling = f.foiling
        AND e.edition = f.edition
        AND f.lss_print_code IS NULL
        AND f.is_front_face IS DISTINCT FROM e.is_front_face
        AND NOT EXISTS (
              SELECT 1 FROM printings e3
               WHERE e3.language = 'en'
                 AND e3.card_unique_id = f.card_unique_id
                 AND e3.set = f.set
                 AND e3.collector_number = f.collector_number
                 AND e3.foiling = f.foiling
                 AND e3.edition = f.edition
                 AND e3.is_front_face <> e.is_front_face)`,
  );

  // Pass 2 — link each foreign row to the foreign counterpart (same language)
  // of its English mirror's other face. Face flags (fixed above) join both
  // sides deterministically, including same-card DFCs. NULL guard = idempotent
  // and never rewrites an existing link; rows whose faces couldn't be
  // classified simply find no f2 and stay unlinked.
  const linked = await pool.query(
    `UPDATE printings f
        SET other_face_printing_id = f2.printing_id
       FROM printings e
       JOIN printings e2 ON e2.printing_id = e.other_face_printing_id
       JOIN printings f2 ON f2.card_unique_id = e2.card_unique_id
                        AND f2.set = e2.set
                        AND f2.collector_number = e2.collector_number
                        AND f2.foiling = e2.foiling
                        AND f2.edition = e2.edition
                        AND f2.is_front_face = e2.is_front_face
      WHERE f.language <> 'en'
        AND e.language = 'en'
        AND f2.language = f.language
        AND e.card_unique_id = f.card_unique_id
        AND e.set = f.set
        AND e.collector_number = f.collector_number
        AND e.foiling = f.foiling
        AND e.edition = f.edition
        AND e.is_front_face = f.is_front_face
        AND f.other_face_printing_id IS NULL`,
  );

  return {
    facesFlagged: (flaggedByCode.rowCount ?? 0) + (flaggedByMirror.rowCount ?? 0),
    pairsLinked: linked.rowCount ?? 0,
  };
}
