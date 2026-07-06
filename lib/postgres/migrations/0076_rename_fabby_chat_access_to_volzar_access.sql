-- Product rename: Fabby Chat → Volzar. Pure column rename, no semantic change:
-- the manual superadmin access grant (added in 0075) keeps its values.
-- Guarded so the migration is a no-op if the column was already renamed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'fabby_chat_access'
  ) THEN
    ALTER TABLE users RENAME COLUMN fabby_chat_access TO volzar_access;
  END IF;
END $$;
