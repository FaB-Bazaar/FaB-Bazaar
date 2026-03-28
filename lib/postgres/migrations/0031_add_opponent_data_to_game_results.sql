-- Migration 0031: Add opponent card data to game_results
--
-- Changes:
-- 1. Replace single-column unique on talishar_game_guid with composite
--    unique on (deck_id, talishar_game_guid) so both players can each
--    have their own record for the same game.
-- 2. Add opponent_card_results and opponent_turn_log JSONB columns.
--    These are NULL when the opponent opted out of stats sharing
--    (Talishar strips cardResults from opted-out players).

-- Drop old unique constraints on talishar_game_guid
DROP INDEX IF EXISTS idx_game_results_guid;
ALTER TABLE game_results DROP CONSTRAINT IF EXISTS game_results_talishar_game_guid_unique;

-- Composite unique: one record per (deck, game) pair
CREATE UNIQUE INDEX idx_game_results_deck_guid
  ON game_results(deck_id, talishar_game_guid)
  WHERE talishar_game_guid IS NOT NULL;

-- Opponent card data (null = opponent opted out of stats sharing)
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS opponent_card_results JSONB;
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS opponent_turn_log JSONB;
