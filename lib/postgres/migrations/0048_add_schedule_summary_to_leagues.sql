-- Add a free-text schedule cadence to leagues so the directory page can
-- show "Every Sunday 7pm UTC", "Swiss over the month — play 5 games at
-- your own pace", "Monthly, last Saturday", etc.
--
-- Free-text rather than enum: cadences in the wild vary too much to enum
-- without churn. If we ever need filtering ("only weekly"), we can add a
-- structured cadence_type column later without disturbing this one.

ALTER TABLE leagues ADD COLUMN schedule_summary text;

DO $$ BEGIN
  PERFORM 1 FROM pg_roles WHERE rolname = 'fabbazaar_app';
  IF FOUND THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leagues TO fabbazaar_app;
  END IF;
END $$;
