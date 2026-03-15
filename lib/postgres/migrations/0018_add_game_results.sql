CREATE TYPE game_result AS ENUM ('win', 'loss');

CREATE TABLE game_results (
  id                   TEXT PRIMARY KEY,
  deck_id              TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,

  talishar_game_id     TEXT,
  talishar_game_guid   TEXT,

  format               TEXT,
  player_hero          TEXT,
  opponent_hero        TEXT,

  result               game_result NOT NULL,
  conceded             BOOLEAN NOT NULL DEFAULT false,
  first_player         BOOLEAN,
  total_turns          INTEGER,

  card_results         JSONB,
  turn_results         JSONB,

  played_at            TIMESTAMP NOT NULL DEFAULT now(),
  created_at           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_results_deck_id ON game_results(deck_id);
CREATE INDEX idx_game_results_deck_played ON game_results(deck_id, played_at DESC);
CREATE UNIQUE INDEX idx_game_results_guid ON game_results(talishar_game_guid) WHERE talishar_game_guid IS NOT NULL;

GRANT ALL ON TABLE game_results TO fabbazaar_app;
