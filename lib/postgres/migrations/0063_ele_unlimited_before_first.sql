-- 0063_ele_unlimited_before_first.sql
-- Tales of Aria (ELE) had both 1st and Unlimited editions; like WTR/ARC/CRU/MON,
-- unlimited is the common accessible printing and should lead edition ordering
-- (printing carousels, import defaults, the grouped-search representative).
-- Regenerate the constants snapshot after applying (scripts/generate-set-constants.ts).

UPDATE sets SET unlimited_before_first = true, updated_at = now() WHERE code = 'ele';
