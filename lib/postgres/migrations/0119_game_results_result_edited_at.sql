-- 0119: Record when a deck owner manually corrected a game's win/loss
--
-- Talishar reports what happened at the end of the game, which is not
-- always the real outcome (e.g. a concession after a take-back that was then
-- played out and won). The owner can flip win/loss from the Results tab;
-- result_edited_at marks the row so stats can show it was corrected.
-- NULL = the result is exactly what Talishar reported. The original payload
-- is untouched in game_result_payloads. Talishar sync inserts with
-- ON CONFLICT DO NOTHING, so a re-sync never reverts a correction.

ALTER TABLE game_results ADD COLUMN IF NOT EXISTS result_edited_at timestamp;
