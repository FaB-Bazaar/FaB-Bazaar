-- 0099: Binder privacy — hide total value + per-binder default sort
--
-- hide_value: owner opts out of advertising the binder's total value.
--   Value aggregates are stripped for non-owner viewers at the API layer.
-- default_sort: initial sort for the binder page (NULL = app default,
--   which is tcg-low-desc, or name A-Z when hide_value is set).

ALTER TABLE binders ADD COLUMN IF NOT EXISTS hide_value boolean NOT NULL DEFAULT false;
ALTER TABLE binders ADD COLUMN IF NOT EXISTS default_sort text;
