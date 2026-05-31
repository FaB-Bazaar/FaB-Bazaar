-- Add `tags` column to binders: flat, owner-defined labels used to group
-- binders into sections on the public profile (e.g. {inventory}, {trades}).
--
-- Why a text[] column and not a folders table:
--   - Tags are a flat organizational layer, not a hierarchy. A binder may
--     carry several, and grouping happens purely at render time on the
--     profile after visibility filtering.
--   - This avoids the folder-vs-binder visibility collision: visibility stays
--     per-binder (public/unlisted/private), tags only decide which section a
--     *public* binder renders under.
--
-- Empty `{}` for every existing binder, so the profile renders exactly as it
-- does today until an owner starts tagging.

ALTER TABLE binders
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];
