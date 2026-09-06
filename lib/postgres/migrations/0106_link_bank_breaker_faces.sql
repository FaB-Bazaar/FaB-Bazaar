-- 0106: link the Construct Bank Breaker // Bank Breaker faces.
--
-- Why: fab-cube never flags this transform pair as double-sided — AMX022
-- ships the linkage with is_DFC = false on both faces, JDG052 ships no
-- double_sided_card_info at all — so pipeline 003 emitted both faces as
-- unlinked FRONTS and the deck view / search flip had nothing to show for
-- the back (every other transform pair, e.g. Nitro Mechanoid, works).
--
-- Durable fix is in 003 (index_face_links now also pairs two different cards
-- sharing one (set, collector, edition, foiling) when exactly one image is
-- the *_BACK.webp face). This migration brings the DB to the same shape so
-- the app is right at deploy time and the nightly upsert is a no-op.
--
-- Keyed on the two CARD ids (fab-cube-anchored, so identical on every DB —
-- printing_ids of the FR/JA i18n rows are minted per DB and are NOT stable)
-- and the printing natural key, so each language/foiling pair links to its
-- own partner. Value-only rewrite of two pipeline-owned columns on rows that
-- are currently unlinked; idempotent; no ids change, no deletes, no user
-- tables. Expected: 4 pairs (AMX022 en/fr/ja, JDG052 en) = 8 rows.

WITH pair AS (
  SELECT f.printing_id AS front_id, b.printing_id AS back_id
    FROM printings f
    JOIN printings b
      ON b.set = f.set AND b.collector_number = f.collector_number
     AND b.edition = f.edition AND b.foiling = f.foiling AND b.language = f.language
   WHERE f.card_unique_id = 'RNCWjkhhdhrHCNRncqznq'   -- construct bank breaker (front)
     AND b.card_unique_id = 'hHTFWRhbq9F7CwwbQqNQ8'   -- bank breaker (back)
     AND f.other_face_printing_id IS NULL
     AND b.other_face_printing_id IS NULL
),
fronts AS (
  UPDATE printings p
     SET other_face_printing_id = pair.back_id, is_front_face = true
    FROM pair WHERE p.printing_id = pair.front_id
  RETURNING 1
)
UPDATE printings p
   SET other_face_printing_id = pair.front_id, is_front_face = false
  FROM pair WHERE p.printing_id = pair.back_id;
