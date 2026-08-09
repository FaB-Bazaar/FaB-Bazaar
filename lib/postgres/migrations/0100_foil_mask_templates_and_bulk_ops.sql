-- 0100_foil_mask_templates_and_bulk_ops.sql
-- Make bulk foil-mask editing previewable and reversible.
--
-- Why: the admin mask editor's "apply to all matching" wrote straight to the
-- DB on a single click with no count shown beforehand and no way back. On the
-- current catalogue that button covers ~11.4k rainbow-foil printings. Worse,
-- bulk apply only writes where foil_inset_bottom IS NULL, so a wrong bulk run
-- immediately marks every row it touched as "set" and therefore immune to a
-- corrective bulk run — the damage could only be undone one card at a time.
--
-- Two tables:
--   foil_mask_templates — named, reusable inset presets for the editor's rail.
--   foil_mask_bulk_ops  — an audit row per bulk apply carrying each affected
--                         printing's PRIOR values, which is what makes undo
--                         possible. prior_values is [{p,t,r,b,l,rd}, ...] where
--                         p = printing_id and a null t/r/b/l/rd means the row
--                         had no mask before the op (the common case).

CREATE TABLE IF NOT EXISTS foil_mask_templates (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  foil_inset_top    real NOT NULL,
  foil_inset_right  real NOT NULL,
  foil_inset_bottom real NOT NULL,
  foil_inset_left   real NOT NULL,
  foil_inset_round  text NOT NULL DEFAULT '1.5%',
  -- Optional note describing which frames the preset is meant for.
  notes             text,
  sort_order        integer NOT NULL DEFAULT 0,
  created_by        text REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_foil_mask_templates_name
  ON foil_mask_templates(lower(name));

CREATE TABLE IF NOT EXISTS foil_mask_bulk_ops (
  id                text PRIMARY KEY,
  -- 'selection' = explicit printing_id list; 'match' = criteria-based sweep.
  kind              text NOT NULL,
  -- Human-readable summary of what was targeted, rendered back in the UI.
  description       text NOT NULL,
  foil_inset_top    real NOT NULL,
  foil_inset_right  real NOT NULL,
  foil_inset_bottom real NOT NULL,
  foil_inset_left   real NOT NULL,
  foil_inset_round  text NOT NULL,
  affected_count    integer NOT NULL,
  -- Per-printing snapshot taken inside the same transaction as the update.
  prior_values      jsonb NOT NULL,
  undone_at         timestamp,
  created_by        text REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamp NOT NULL DEFAULT now()
);

-- The UI only ever lists the most recent ops, newest first.
CREATE INDEX IF NOT EXISTS idx_foil_mask_bulk_ops_created_at
  ON foil_mask_bulk_ops(created_at DESC);

-- Seed the rail from the shapes already present in the data. Five of these are
-- the per-set standard frames that account for ~1.7k of the ~1.8k printings
-- masked by hand so far; the extended-art and full-art entries come from the
-- smaller clusters. Every field is editable in the admin UI — these are a
-- starting point, not a fixed vocabulary.
INSERT INTO foil_mask_templates (id, name, foil_inset_top, foil_inset_right, foil_inset_bottom, foil_inset_left, foil_inset_round, notes, sort_order)
VALUES
  ('tpl-standard-wtr', 'Standard frame — WTR',       12,   9.5, 39.5, 9.5, '1.5%', 'Welcome to Rathe standard card frame',            10),
  ('tpl-standard-arc', 'Standard frame — ARC',       12.5, 9.5, 40.5, 9.5, '1.5%', 'Arcane Rising standard card frame',               20),
  ('tpl-standard-cru', 'Standard frame — CRU',       12.5, 8.5, 40.5, 9,   '1.5%', 'Crucible of War standard card frame',             30),
  ('tpl-standard-mon', 'Standard frame — MON',       13,   9,   40.5, 9,   '1.5%', 'Monarch standard card frame',                     40),
  ('tpl-standard-evr', 'Standard frame — EVR',       13,   9,   40,   9,   '1.5%', 'Everfest standard card frame',                    50),
  ('tpl-ea-full',      'Extended art — art to base', 12.5, 9.5, 11.5, 9.5, '1.5%', 'Extended art with no text box; art runs to the bottom', 60),
  ('tpl-ea-textbox',   'Extended art — with text box', 12.5, 9.5, 24, 9.5, '1.5%', 'Extended art that still has a rules text box',     70),
  ('tpl-full-art',     'Full art / hero',            0,    0,   0,    0,   '1.5%', 'Whole card foils — hero cards, full-art promos',   80)
ON CONFLICT (id) DO NOTHING;
