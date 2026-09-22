-- 0113: put Levia, Redeemed // Blasmophet (DTD164 non-foil) faces the right
-- way round.
--
-- Why: the fab-cube feed ships the DTD164 NON-FOIL pair with `is_front`
-- swapped (Levia, Redeemed flagged as the back, Blasmophet as the front; the
-- cold-foil pair is fine) while its image filenames are right. The app mints
-- the deterministic image id from that flag (`_BACK` suffix), so the English
-- rows were cross-wired: Levia's row pointed at DTD164_BACK (the Blasmophet
-- art) and Blasmophet's at DTD164 (the Levia art) — the printing page for
-- Levia, Redeemed showed Blasmophet. The only such disagreement in the feed
-- (2 of 204 DFC printings, checked 2026-09-21).
--
-- Durable fix is in pipeline 003 (`get_dfc_fields`: the *_BACK image
-- filename now overrides a contradicting is_front flag). This migration
-- brings the DB to the same shape so the nightly upsert is a no-op.
--
-- Keyed on the two CARD ids (fab-cube-anchored, identical on every DB) and
-- the natural key; idempotent (only rows still flagged the wrong way match).
--
-- English rows: flip is_front_face AND swap image_url between the two rows —
-- the Cloudflare images DTD164 / DTD164_BACK hold the right art.
-- FR/DE/ES/IT rows: flip is_front_face ONLY. Their CardVault ingest uploaded
-- each card's correct art under the id the wrong flag produced, so today
-- `XX_DTD164` holds Blasmophet and `XX_DTD164_BACK` holds Levia: the rows
-- show the right art and stay as they are. The ids are misnamed relative to
-- the deterministic recipe; re-minting them (scripts/migrate-image-ids.ts)
-- would repoint them at the wrong art until those 8 images are re-uploaded
-- under swapped ids.

WITH pair AS (
  SELECT l.printing_id AS levia_id, b.printing_id AS blas_id, l.language,
         l.image_url AS levia_img, b.image_url AS blas_img
    FROM printings l
    JOIN printings b
      ON b.set = l.set AND b.collector_number = l.collector_number
     AND b.edition = l.edition AND b.foiling = l.foiling AND b.language = l.language
   WHERE l.card_unique_id = 'qjqqRn6kHWHGz6PQGWd7z'   -- levia, redeemed (front)
     AND b.card_unique_id = 'dbrfzmNJ9ccB9CW68pmQp'   -- blasmophet, levia consumed (back)
     AND l.collector_number = 'DTD164' AND l.foiling = 's'
     AND l.is_front_face = false AND b.is_front_face = true
),
levia AS (
  UPDATE printings p
     SET is_front_face = true,
         image_url = CASE WHEN pair.language = 'en' THEN pair.blas_img ELSE p.image_url END
    FROM pair WHERE p.printing_id = pair.levia_id
  RETURNING 1
)
UPDATE printings p
   SET is_front_face = false,
       image_url = CASE WHEN pair.language = 'en' THEN pair.levia_img ELSE p.image_url END
  FROM pair WHERE p.printing_id = pair.blas_id;
