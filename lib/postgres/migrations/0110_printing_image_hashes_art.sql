-- 0110: art-region hash for the card scanner.
-- pHash of a fixed art rectangle (x 8-92%, y 12-55% of the card) — the region
-- every FaB frame shares — computed after deskewing. Matching on the art
-- ignores the text box, borders and glare; the whole-card hashes stay as
-- tie-breakers. Nullable: rows are backfilled by scripts/compute-image-hashes.ts
-- --force (the app treats NULL as "no art hash", ranking on the other two).
ALTER TABLE printing_image_hashes ADD COLUMN IF NOT EXISTS art_phash CHAR(16);
