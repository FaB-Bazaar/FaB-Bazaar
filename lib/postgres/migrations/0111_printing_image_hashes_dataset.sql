-- 0111: the scanner index now uses the fab-cube dataset's exact pHash recipe
-- (phash = whole card, art_phash = fixed art rect) so the dataset's precomputed
-- values can be imported directly. Imported rows carry no gradient hash.
ALTER TABLE printing_image_hashes ALTER COLUMN dhash DROP NOT NULL;
