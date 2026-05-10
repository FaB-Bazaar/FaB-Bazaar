-- Community leagues: persistent groups of players running tournament series
-- (e.g. InkBlade League — weekly Silver Age league played on Talishar).
--
-- v1 covers leagues, events, and per-event results. Memberships and signups
-- are intentionally deferred: Discord stays the source of truth for "who's
-- in the community" via discord_guild_id on the league row. When signups
-- arrive later, they go in their own league_event_signups table without
-- touching results.
--
-- Privacy: user_id and deck_id on league_event_decks are nullable so an
-- organizer can post a result for a player who isn't on FaB Bazaar (or
-- doesn't want to be linked publicly). player_handle is always set —
-- usually a Discord username or an anonymous tag — and never anything
-- more identifying than that.
--
-- Both leagues and league_events carry their own `public` flag. A private
-- league hides every event regardless of event flag; a public league with
-- a private event keeps that event URL-only (e.g. private playtest).

-- ------------------------------------------------------------
-- leagues
-- ------------------------------------------------------------
CREATE TABLE leagues (
    id                  text PRIMARY KEY,
    slug                text NOT NULL UNIQUE,                                 -- URL: /leagues/inkblade
    name                text NOT NULL,
    description         text,
    format              text,                                                  -- default format for events; per-event override allowed
    banner_url          text,
    discord_guild_id    text,                                                  -- powers "Join Discord" link on the league page
    discord_invite_url  text,                                                  -- human-friendly invite; organizer can refresh
    -- Owner can be NULL: if the creator deletes their account, the league
    -- survives as ownerless rather than being cascade-deleted. Reassignment
    -- or cleanup is handled manually. Result rows in league_event_decks
    -- similarly use SET NULL so historical "I played Lyath 5-1" data is
    -- preserved even after a user's profile disappears.
    owner_id            text REFERENCES users(id) ON DELETE SET NULL,
    public              boolean NOT NULL DEFAULT true,                         -- false = unlisted (URL-only)
    metadata            jsonb,                                                 -- league-specific extensions (scoring, season, sponsor logos)
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_leagues_owner_id ON leagues (owner_id);
CREATE INDEX idx_leagues_public   ON leagues (public) WHERE public = true;

-- ------------------------------------------------------------
-- league_events
-- ------------------------------------------------------------
-- One per scheduled tournament/round within a league. status is plain text
-- (not an enum) so adding a new state — e.g. 'postponed' — doesn't need a
-- migration.
CREATE TABLE league_events (
    id              text PRIMARY KEY,
    league_id       text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    scheduled_for   timestamp NOT NULL,
    status          text NOT NULL DEFAULT 'upcoming',                          -- upcoming | in_progress | complete | cancelled
    format          text,                                                      -- override of leagues.format
    public          boolean NOT NULL DEFAULT true,                             -- false = URL-only; lets a public league hide a specific event
    metadata        jsonb,
    created_at      timestamp NOT NULL DEFAULT now(),
    updated_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_league_events_league_scheduled
    ON league_events (league_id, scheduled_for DESC);

-- Partial index keeps the public "what's coming up" feed fast as the table
-- grows; private and completed events live in the broader index above.
CREATE INDEX idx_league_events_public_upcoming
    ON league_events (scheduled_for)
    WHERE public = true AND status IN ('upcoming', 'in_progress');

-- ------------------------------------------------------------
-- league_event_decks
-- ------------------------------------------------------------
-- One row per (event, player) result. Both deck_id and user_id are
-- nullable — see the privacy note in the file header.
--
-- record/dropped_round/byes are nullable from day one so future signup
-- flows and richer scoring don't need a migration. metadata jsonb is the
-- escape hatch for anything else a specific league cares about.
CREATE TABLE league_event_decks (
    id              text PRIMARY KEY,
    event_id        text NOT NULL REFERENCES league_events(id) ON DELETE CASCADE,
    deck_id         text REFERENCES decks(id) ON DELETE SET NULL,
    user_id         text REFERENCES users(id) ON DELETE SET NULL,
    player_handle   text NOT NULL,                                              -- Discord username or anonymous tag; nothing more identifying
    -- hero_name: denormalized copy of decks.hero_name at result-recording
    -- time, so "I played Lyath in round 4" survives deck deletion. Source
    -- of truth while the deck exists is still decks.hero_name; this column
    -- is the historical record.
    hero_name       text,
    "placing"       integer,                                                    -- quoted: PLACING is a reserved word in PG (used in OVERLAY)
    match_record    text,                                                       -- free-form, e.g. "5-1-0" (column avoids the reserved word `record`)
    dropped_round   integer,
    byes            integer,
    metadata        jsonb,
    created_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_league_event_decks_event_placing
    ON league_event_decks (event_id, "placing" ASC NULLS LAST);

-- Partial indexes — keep the "decks by user" / "events for deck" queries
-- fast without paying for rows where the FK is null.
CREATE INDEX idx_league_event_decks_user
    ON league_event_decks (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_league_event_decks_deck
    ON league_event_decks (deck_id) WHERE deck_id IS NOT NULL;

-- ------------------------------------------------------------
-- Handle scrubbing on user deletion
-- ------------------------------------------------------------
-- When a user deletes their account, the FK SET NULL action above clears
-- league_event_decks.user_id, but player_handle (typically a Discord
-- username) is a plain text column and would otherwise survive. To honor
-- the deletion, replace the handle with a sentinel before the FK action
-- fires.
--
-- BEFORE DELETE timing matters: by the time an AFTER DELETE trigger runs,
-- user_id has already been SET NULL, so we'd lose the ability to filter
-- which rows belonged to this user.
--
-- hero_name, placing, match_record etc. are preserved — those are about
-- the game/result, not the player's identity.

CREATE OR REPLACE FUNCTION scrub_league_handles_on_user_delete() RETURNS TRIGGER AS $$
BEGIN
  UPDATE league_event_decks
     SET player_handle = '[deleted player]'
   WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_scrub_league_handles
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION scrub_league_handles_on_user_delete();

-- ------------------------------------------------------------
-- App-role grants
-- ------------------------------------------------------------
-- Production connects as fabbazaar_app (least privilege). Local dev runs
-- as the superuser fabbazaar, where this block is a no-op. Guarded with
-- pg_roles so the migration is safe in environments where fabbazaar_app
-- doesn't exist.
DO $$ BEGIN
  PERFORM 1 FROM pg_roles WHERE rolname = 'fabbazaar_app';
  IF FOUND THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leagues            TO fabbazaar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.league_events      TO fabbazaar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.league_event_decks TO fabbazaar_app;
  END IF;
END $$;
