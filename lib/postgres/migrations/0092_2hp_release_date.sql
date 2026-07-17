-- 0092: History Pack Vol.2 released 2023-02-24, but its sets row carried a
-- NULL release_date — which serializes to '' in the generated constants
-- snapshot and NaNs the /sets standard-section date sort, floating 2HP to
-- the top as if it were the newest set.
-- Idempotent: only fills the NULL.

UPDATE sets
   SET release_date = '2023-02-24'
 WHERE code = '2hp'
   AND release_date IS NULL;
