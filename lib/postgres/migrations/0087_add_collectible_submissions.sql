-- 0087_add_collectible_submissions.sql
-- Crowdsourced collectible submissions: any signed-in user can suggest a NEW
-- catalog entry (collectible_id NULL) or a CORRECTION to an existing one
-- (collectible_id set). Superadmins review in /admin/collectibles: approve
-- applies the proposed fields to the catalog, reject just closes the row.
--
-- Proposed fields mirror collectibles (all nullable — an edit submission only
-- carries the fields the submitter filled in; NULL = "no change proposed").
-- `notes` is a free-text message to the reviewer and is never copied to the
-- catalog. Reviewed rows are kept for provenance/audit, not deleted.

DO $$ BEGIN
  CREATE TYPE collectible_submission_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS collectible_submissions (
  id text PRIMARY KEY,
  -- NULL = proposal for a brand-new catalog entry; set = edit suggestion.
  -- Cascade: if the catalog entry is deleted, its edit suggestions are moot.
  collectible_id text REFERENCES collectibles(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind collectible_kind NOT NULL DEFAULT 'playmat',
  name text,
  description text,
  image_url text,
  artist text,
  source text,
  year integer,
  notes text,
  status collectible_submission_status NOT NULL DEFAULT 'pending',
  reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collectible_submissions_status
  ON collectible_submissions(status);
CREATE INDEX IF NOT EXISTS idx_collectible_submissions_user
  ON collectible_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_collectible_submissions_collectible
  ON collectible_submissions(collectible_id);
