-- 0069: Raw Talishar payload archive — sidecar table for game_results.
--
-- The typed game_results columns intentionally keep only a curated subset of
-- what Talishar POSTs per game (card_results, turn_results, turn_log + the
-- opponent variants). That drops several fields Talishar actually sends:
-- arenaCardResults (equipment/weapon/companion stats), tokenResults, the
-- character loadout, and ~30 precomputed per-game aggregates
-- (totalDamageDealt, averageValuePerTurn, …).
--
-- This sidecar stores the FULL deck blob verbatim so none of that is lost
-- going forward. It is deliberately a separate table (not a column) so it can
-- be dropped wholesale later with zero impact on game_results, and so the raw
-- blob is never pulled into a default game_results SELECT.
--
-- Data capture is gated in the service layer: a row is written ONLY when the
-- deck owner is an admin/superadmin. Opponent data is consent-gated to mirror
-- the opponent_card_results behaviour of the main row.

CREATE TABLE IF NOT EXISTS game_result_payloads (
  result_id  text PRIMARY KEY REFERENCES game_results(id) ON DELETE CASCADE,
  payload    jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
