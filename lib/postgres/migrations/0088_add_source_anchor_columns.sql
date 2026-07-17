-- 0088: source-anchor columns for the dual-source ID model (CardVault new-set
-- ingest + fab-cube reconciliation).
--
-- printing_id / card_unique_id remain OUR immutable internal PKs — user FKs
-- (inventory_items, wants_items, deck_cards, curated_list_cards) and
-- Cloudflare image IDs key on them and never change. The anchor columns
-- record which upstream row a printing/card is reconciled to:
--
--   printings.fab_cube_printing_id  fab-cube printing unique_id. NULL means
--                                   "provisional": not (yet) in the fab-cube
--                                   feed — the pipeline's stale-delete must
--                                   never prune such rows, and the 005
--                                   adoption pass will stamp it when fab-cube
--                                   publishes the printing.
--   printings.lss_print_id          CardVault print UUID (their DB PK).
--                                   Idempotency key for CardVault ingest —
--                                   the human print code is NOT unique in
--                                   rough spoiler data, the UUID is.
--   printings.lss_print_code        CardVault human print code (e.g.
--                                   'U-ARC029-RF', 'IAR159-MV'). Debug/join
--                                   convenience only.
--   cards.fab_cube_card_id          fab-cube card unique_id (cards.lss_card_id
--                                   already exists as the CardVault anchor).
--
-- Backfill: every English printing and every card today was created by the
-- pipeline with fab-cube's id AS our id, so anchoring is `= printing_id` /
-- `= card_unique_id`. Non-English printings (import-i18n-minted nanoids) have
-- no fab-cube counterpart and stay NULL — matching today's stale-delete
-- exemption exactly.
--
-- Idempotent: IF NOT EXISTS on columns/indexes; backfills only fill NULLs.

ALTER TABLE printings ADD COLUMN IF NOT EXISTS fab_cube_printing_id text;
ALTER TABLE printings ADD COLUMN IF NOT EXISTS lss_print_id text;
ALTER TABLE printings ADD COLUMN IF NOT EXISTS lss_print_code text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS fab_cube_card_id text;

UPDATE printings
   SET fab_cube_printing_id = printing_id
 WHERE language = 'en' AND fab_cube_printing_id IS NULL;

UPDATE cards
   SET fab_cube_card_id = card_unique_id
 WHERE fab_cube_card_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_printings_fab_cube_printing_id
    ON printings (fab_cube_printing_id) WHERE fab_cube_printing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_printings_lss_print_id
    ON printings (lss_print_id) WHERE lss_print_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cards_fab_cube_card_id
    ON cards (fab_cube_card_id) WHERE fab_cube_card_id IS NOT NULL;
