-- 0080_add_facet_votes_suggestions_audit.sql
-- Opens card facets to signed-in users (was curator/superadmin only), on a
-- vote-aggregation model rather than a binary wiki set.
--
-- Three new tables:
--   1. card_facet_tag_votes — one row per (card, tag, user). The COUNT of distinct
--      voters is the community confidence signal. A community tag enters the
--      searchable projection (cards.facet_tags) only at >= 2 votes; the existing
--      curator-assigned card_facet_tags stays AUTHORITATIVE (always projected).
--      Removing a tag = retracting your own vote, so no single user can strip a
--      tag others agree on. Votes fan out across same-name pitch variants, exactly
--      like curator assignments.
--   2. facet_tag_audit — append-only log of every add/remove. Deliberately NO
--      foreign keys, so the trail survives user/card deletion (accountability for
--      malicious actors).
--   3. facet_tag_suggestions — a review queue. Users PROPOSE new vocabulary terms;
--      a curator approves (minting a facet_tag_definitions row) or rejects.
--      Suggestions never touch cards.facet_tags — the AI vocabulary stays
--      curator-controlled until promotion.

-- 1. Community votes. tag CASCADEs (deleting a definition clears its votes);
--    the projection is recomputed by the facet service, never trusted in place.
CREATE TABLE IF NOT EXISTS card_facet_tag_votes (
  card_unique_id text NOT NULL REFERENCES cards(card_unique_id) ON DELETE CASCADE,
  tag            text NOT NULL REFERENCES facet_tag_definitions(id) ON DELETE CASCADE,
  user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_unique_id, tag, user_id)
);

-- Count votes per (card, tag) fast, and list a user's votes fast.
CREATE INDEX IF NOT EXISTS idx_card_facet_tag_votes_card_tag ON card_facet_tag_votes (card_unique_id, tag);
CREATE INDEX IF NOT EXISTS idx_card_facet_tag_votes_user ON card_facet_tag_votes (user_id);

-- 2. Append-only audit log. No FKs (see header) — plain text so the row outlives
--    the user/card it references.
CREATE TABLE IF NOT EXISTS facet_tag_audit (
  id             bigserial PRIMARY KEY,
  card_unique_id text,                                             -- null for tag-level actions
  tag            text NOT NULL,
  action         text NOT NULL,                                    -- 'add' | 'remove'
  user_id        text,                                             -- actor; null only if system
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facet_tag_audit_user ON facet_tag_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_facet_tag_audit_card ON facet_tag_audit (card_unique_id);

-- 3. Suggestion review queue.
CREATE TABLE IF NOT EXISTS facet_tag_suggestions (
  id           text PRIMARY KEY,                                   -- app-generated (crypto.randomUUID)
  proposed_id  text,                                               -- suggested slug; curator may finalize on approval
  dim          text NOT NULL,                                      -- 'mechanical' | 'strategic' | 'synergy'
  label        text NOT NULL,
  def          text NOT NULL DEFAULT '',
  rationale    text NOT NULL DEFAULT '',                           -- why the proposer thinks it's needed
  proposed_by  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',                    -- 'pending' | 'approved' | 'rejected'
  reviewed_by  text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facet_tag_suggestions_status ON facet_tag_suggestions (status);
