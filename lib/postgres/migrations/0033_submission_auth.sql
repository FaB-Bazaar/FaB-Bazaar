-- Remove submitter email (PII), add user ID foreign key for authenticated submissions
DROP INDEX IF EXISTS idx_location_submissions_email;
ALTER TABLE location_submissions DROP COLUMN IF EXISTS submitter_email;
ALTER TABLE location_submissions ADD COLUMN IF NOT EXISTS submitted_by_user_id text REFERENCES users(id) ON DELETE SET NULL;
