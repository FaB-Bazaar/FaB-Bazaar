-- 0083_add_facet_vote_visibility.sql
-- Adds a per-vote visibility/approval lifecycle to card_facet_tag_votes.
--
-- A vote now carries a `status`:
--   'private' — creator-only. NEVER counts toward the public projection; only the
--               voter sees it (personal-truth search path). No approval needed.
--   'pending' — the voter asked for this tag to be public; awaiting curator review.
--               Behaves like 'private' (creator-only) until approved.
--   'public'  — curator-approved. COUNTS toward the >= 2 distinct-voter threshold
--               (COMMUNITY_VOTE_THRESHOLD). A public tag still only shows for ALL
--               users at 2+ public votes; below that it stays creator-only.
--
-- The >= 2 threshold is UNCHANGED — approval only decides whether a vote is
-- eligible to be counted. Reproject now counts only status='public' votes.
--
-- Backfill: existing votes were cast under the old "all votes are public community
-- votes" model, so they become 'public'. This preserves current projections
-- exactly (the >= 2 rule still applies to them).

ALTER TABLE card_facet_tag_votes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'private'
    CHECK (status IN ('private', 'pending', 'public'));

-- Existing rows predate this feature and were effectively public. Only touch rows
-- still at the new default so the migration is safe to re-run.
UPDATE card_facet_tag_votes SET status = 'public' WHERE status = 'private';

-- Reviewer bookkeeping for the approval queue (nullable; null = never reviewed).
ALTER TABLE card_facet_tag_votes
  ADD COLUMN IF NOT EXISTS reviewed_by text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE card_facet_tag_votes
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- The approval queue lists all pending votes; index the status for that scan.
CREATE INDEX IF NOT EXISTS idx_card_facet_tag_votes_status ON card_facet_tag_votes (status);
