-- 0105: point double-faced BACK printings at their real front.
--
-- Why: the fab-cube feed ships every double-faced back printing with
-- double_sided_card_info.other_face_unique_id = the back's OWN unique_id
-- (107/107 back faces in the 2026-09 feed), while each front links correctly
-- to its back. Pipeline 003 copied that verbatim, so 322 back rows
-- self-referenced (322/352 back faces locally; 005 upserts the column
-- nightly, so a bare data fix would flip back). Visible result: searching
-- "Nitro Mechanoid" offered "Flip to Nitro Mechanoid" — the back rendered
-- itself as its own flip — because the search enrichment fetched the back
-- row as the FRONT's partner and the back then found its own id in that map.
--
-- The durable fix is in the pipeline: 003 now builds a reverse index
-- (front printing → the back it points at) and resolves a back whose link is
-- missing or self-referential through it, emitting NULL rather than a
-- self-link when no front points at it. This migration brings the DB to that
-- same shape now, so the nightly upsert is a no-op rather than a flip-flop.
--
-- Pick rule per back row (same as the transformer's single-front feed shape;
-- the tie-break only matters for 5 MST000 i18n rows that ALSO have a
-- same-card "front" row pointing at them): prefer a front of a DIFFERENT
-- card, then is_front_face, then printing_id.
--
-- Value-only rewrite of one pipeline-owned column on back rows whose link is
-- a self-reference or NULL. No ids change, no deletes, no user tables.
-- Idempotent: a back already pointing elsewhere is never touched; a back no
-- front points at keeps its NULL (2 rows locally).

WITH pick AS (
  SELECT DISTINCT ON (b.printing_id)
         b.printing_id AS back_id,
         f.printing_id AS front_id
    FROM printings b
    JOIN printings f
      ON f.other_face_printing_id = b.printing_id
     AND f.printing_id <> b.printing_id
   WHERE b.is_front_face = false
     AND (b.other_face_printing_id = b.printing_id OR b.other_face_printing_id IS NULL)
   ORDER BY b.printing_id,
            (f.card_unique_id <> b.card_unique_id) DESC,
            f.is_front_face DESC,
            f.printing_id
)
UPDATE printings b
   SET other_face_printing_id = p.front_id
  FROM pick p
 WHERE b.printing_id = p.back_id;

-- A self-link that no front resolves is worse than NULL: the app would have
-- to special-case it forever. (0 rows expected after the UPDATE above.)
UPDATE printings
   SET other_face_printing_id = NULL
 WHERE other_face_printing_id = printing_id;
