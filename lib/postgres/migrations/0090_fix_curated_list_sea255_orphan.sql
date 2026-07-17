-- 0090: repair a curated_list_cards orphan found by the pre-release check:
-- the "Non-Attack Actions" list row 5fWhwrcpsJ9ki7uwbVpo0 stored the
-- collector number "SEA255" where a printing_id (nanoid) belongs, so the
-- list entry dangled (curated_list_cards has no FK to printings).
-- Repoint it at the English standard-foiling SEA255 printing.
-- Idempotent: only matches the bad value.

UPDATE curated_list_cards
   SET printing_id = 'mmcdRQBW7zK7h9LFdCBpp'
 WHERE id = '5fWhwrcpsJ9ki7uwbVpo0'
   AND printing_id = 'SEA255';
