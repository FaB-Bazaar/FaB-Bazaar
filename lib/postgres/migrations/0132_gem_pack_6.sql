-- 0132: GEM Pack 6 (TCGplayer group 24774, GEM184–GEM218).
--
-- 0067/0068 seeded GEM Packs 1–5 only, so the 61 CardVault-ingested GEM 6
-- printings had no tcg_group_id (missing from the /opt GEM pack filter and the
-- nightly warm-up's "newest pack"). Name/date from tcgcsv's groups endpoint;
-- every GEM184–GEM218 number lists in group 24774.

INSERT INTO tcg_groups (group_id, name, abbreviation, published_on) VALUES
  (24774, 'GEM Pack 6', 'GEM', '2026-09-25')
ON CONFLICT (group_id) DO NOTHING;

UPDATE printings SET tcg_group_id = 24774, updated_at = now()
 WHERE set = 'gem' AND tcg_group_id IS NULL
   AND collector_number BETWEEN 'GEM184' AND 'GEM218';

-- Product ids step 05b (009_provisional_tcg_pricer.py) can't assign on its own:
--   GEM189 / GEM190: CardVault prints them as Cold Foils (GEM189-CF, GEM190-CF);
--     TCGplayer sells them as "(Marvel)", so the variant classes never meet.
--   GEM207 / GEM208: TCGplayer numbers Walker/Ripper swapped vs CardVault
--     (CardVault: Walker = GEM207), so the name check rejects them. Ids are
--     keyed by CARD NAME here, not TCGplayer's number.
-- The rows are provisional (not in the fab-cube feed), so 005 never rewrites
-- them and 009 never overwrites an existing id; the feed_overrides rows keep
-- the ids right once fab-cube adopts the set (same exact-identity key the
-- admin TCGplayer PATCH records).

WITH fix(collector_number, foiling, product_id, url) AS (VALUES
  ('GEM189', 'c', '719278', 'https://www.tcgplayer.com/product/719278/flesh-and-blood-tcg-gem-pack-6-v-of-the-vanguard-marvel'),
  ('GEM190', 'c', '719279', 'https://www.tcgplayer.com/product/719279/flesh-and-blood-tcg-gem-pack-6-soul-harvest-marvel'),
  ('GEM207', 'r', '719524', 'https://www.tcgplayer.com/product/719524/flesh-and-blood-tcg-gem-pack-6-shadowrealm-walker'),
  ('GEM207', 's', '719524', 'https://www.tcgplayer.com/product/719524/flesh-and-blood-tcg-gem-pack-6-shadowrealm-walker'),
  ('GEM208', 'r', '719525', 'https://www.tcgplayer.com/product/719525/flesh-and-blood-tcg-gem-pack-6-shadowrealm-ripper'),
  ('GEM208', 's', '719525', 'https://www.tcgplayer.com/product/719525/flesh-and-blood-tcg-gem-pack-6-shadowrealm-ripper')
),
overrides AS (
  INSERT INTO feed_overrides (id, collector_number, edition, foiling, language, art_variations, set_fields, reason)
  SELECT 'mig0132-' || lower(collector_number) || '-' || foiling,
         collector_number, 'n', foiling, 'en', '{}'::text[],
         jsonb_build_object('tcgplayer_product_id', product_id, 'tcgplayer_url', url),
         'Migration 0132: GEM Pack 6 id 05b cannot match (TCGplayer Marvel label / swapped numbers)'
    FROM fix
  ON CONFLICT DO NOTHING
)
UPDATE printings p
   SET tcgplayer_product_id = fix.product_id, tcgplayer_url = fix.url, updated_at = now()
  FROM fix
 WHERE p.set = 'gem' AND p.language = 'en'
   AND p.collector_number = fix.collector_number AND p.foiling = fix.foiling
   AND p.edition = 'n' AND p.art_variations = '{}'
   AND p.tcgplayer_product_id IS NULL AND p.fab_cube_printing_id IS NULL;
