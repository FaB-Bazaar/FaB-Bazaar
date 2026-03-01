-- Replace deck_category enum: add 'benched', drop 'sideboard' (had zero rows).
-- 'benched' is a personal scratch area for cards under consideration.
-- It is never exported to Talishar and does not count toward deck totals.
BEGIN;
CREATE TYPE deck_category_new AS ENUM ('hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens');
ALTER TABLE deck_cards ALTER COLUMN category TYPE deck_category_new USING category::text::deck_category_new;
DROP TYPE deck_category;
ALTER TYPE deck_category_new RENAME TO deck_category;
COMMIT;
