-- 0094: repair art attribution on 20 foreign twin-print rows (OUT011, OUT094, AAZ005).
--
-- import-i18n mirrored art_variations/is_extended_art from an arbitrary
-- English counterpart, stamping both prints of a rainbow regular-art +
-- extended-art pair (or AA alt-art pair) with identical attributes.
-- Correct per-row values were recovered by perceptual image matching
-- against the English sibling variants (margin-checked; see the
-- 2026-07-18 reconcile plan). printing_ids verified identical on prod.
-- Idempotent: fixed values keyed by immutable PKs.

UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = '9aWEgFkMVT9f-07MWr9Sr';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'wp7Dj0Es6DasvIC0O4Bp7';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'FKMyaFPYAvOznbWZSozzz';
UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = 'ran5ksjWwbqPJuaH2NzIf';
UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = '9nL0xFYvzwpabjhponU5n';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'iIQPAkXwC4Empv1Ddz51G';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'Yxiol7hbJrxNGIzLNBTLi';
UPDATE printings SET art_variations = '{AA}', is_extended_art = false WHERE printing_id = 'g8Tp3cYdatGyJ0sBLnBwQ';
UPDATE printings SET art_variations = '{AA}', is_extended_art = false WHERE printing_id = 'TrluXAngPsXh4m7bgQsYN';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'x_cgB2PRRzCSf4IN_LZYE';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = '8GDIXiJ4lYVzlzzuPgFRn';
UPDATE printings SET art_variations = '{AA}', is_extended_art = false WHERE printing_id = 'Kw2jPteGfRfM5Gv9Xiwvg';
UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = 'I-WGwOEI1Gb-OKWImRpLY';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'bmgitjHq8_KBSjZBLFgE1';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'TQhIbQnmptmkcsWuDwgLq';
UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = 'hfyRpfV5gJMZT_QX0MBxL';
UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = 'RD4HbCMxjoBp36_ezC8lK';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'eCsp2DeVRbmY_Vm2Ytr4B';
UPDATE printings SET art_variations = '{}', is_extended_art = false WHERE printing_id = 'JyTNsqyALhRWi646t7xJg';
UPDATE printings SET art_variations = '{EA}', is_extended_art = true WHERE printing_id = 'KzrIOSZLb7NkWQICI-kRt';
