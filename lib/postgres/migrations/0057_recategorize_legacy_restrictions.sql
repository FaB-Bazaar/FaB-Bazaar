-- Recategorize legacy restrictions to FaB's real taxonomy.
--
-- The registry historically stored three distinct FaB concepts all as
-- restriction_type='banned'. Split them by is_hero (the only banned *heroes*
-- in CC/SA are graduates/benched — every true ban is a non-hero card):
--   - CC banned heroes  → 'living_legend' (graduated out of Classic Constructed)
--   - SA banned heroes  → 'benched'       (seasonal Silver Age rotation)
--   - everything else    → unchanged
--
-- Then re-project the denormalized cards.* columns to match the new statuses
-- (the old 'banned' write-through had set *_banned=true). Idempotent: once a row
-- is living_legend/benched it no longer matches the 'banned' predicate, and the
-- column fixes are deterministic. Benching windows are left NULL (= indefinite
-- until lifted); set the precise "until Set N" window editorially in the admin UI.

-- 1. CC banned heroes are Living Legend graduates.
UPDATE banned_cards b
SET restriction_type = 'living_legend', updated_at = now()
FROM cards c
WHERE c.card_unique_id = b.card_unique_id
  AND b.format = 'classic_constructed'
  AND b.restriction_type = 'banned'
  AND c.is_hero = true;

-- 2. SA banned heroes are benched (seasonal).
UPDATE banned_cards b
SET restriction_type = 'benched', reason = 'community_vote', updated_at = now()
FROM cards c
WHERE c.card_unique_id = b.card_unique_id
  AND b.format = 'silver_age'
  AND b.restriction_type = 'banned'
  AND c.is_hero = true;

-- 3. Fix denormalized columns for the now-living_legend CC graduates:
--    no longer cc_banned; legality reflects graduation (cc_legal=false, ll_legal=true).
UPDATE cards SET cc_banned = false, cc_legal = false, ll_legal = true
WHERE card_unique_id IN (
  SELECT card_unique_id FROM banned_cards
  WHERE format = 'classic_constructed' AND restriction_type = 'living_legend' AND status_active = true
);

-- 4. Fix denormalized columns for the now-benched SA heroes:
--    no longer silver_age_banned; in-window benches set silver_age_suspended.
UPDATE cards SET silver_age_banned = false, silver_age_suspended = true
WHERE card_unique_id IN (
  SELECT card_unique_id FROM banned_cards
  WHERE format = 'silver_age' AND restriction_type = 'benched' AND status_active = true
    AND (date_expires IS NULL OR date_expires > now())
);
