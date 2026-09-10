-- 0109: perceptual-hash index for the card scanner (/scan).
--
-- One row per printing image: two 64-bit hashes (pHash = DCT low-frequency
-- signs, dHash = gradient signs) stored as 16-char hex. Built by
-- scripts/compute-image-hashes.ts from the Cloudflare renders; the app loads
-- the whole table into memory (~17k rows) and ranks by Hamming distance.
-- image_url records which render was hashed so a re-run skips unchanged rows.
-- Not pipeline-owned: the nightly never touches it. Cascade on printing delete.

CREATE TABLE IF NOT EXISTS printing_image_hashes (
  printing_id TEXT PRIMARY KEY REFERENCES printings(printing_id) ON DELETE CASCADE,
  phash CHAR(16) NOT NULL,
  dhash CHAR(16) NOT NULL,
  image_url TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
