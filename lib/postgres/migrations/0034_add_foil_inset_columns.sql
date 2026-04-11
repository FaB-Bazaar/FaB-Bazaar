-- Migration 0034: Add foil inset columns to printings
-- These four percentage columns (0–100) drive the rainbow-foil clip-path
-- via CSS custom properties, replacing the previous data-attribute approach.
-- foil_inset_round stores the border-radius portion of inset() (e.g. "1.5%", "0%", "8px").
-- All columns are nullable; NULL means fall back to the artStyle-derived defaults.

ALTER TABLE printings
  ADD COLUMN foil_inset_top    real,
  ADD COLUMN foil_inset_right  real,
  ADD COLUMN foil_inset_bottom real,
  ADD COLUMN foil_inset_left   real,
  ADD COLUMN foil_inset_round  text;
