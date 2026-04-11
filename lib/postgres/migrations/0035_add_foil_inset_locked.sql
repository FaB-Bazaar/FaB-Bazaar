-- Migration 0035: Add foil_inset_locked to printings
-- When true, bulk foil mask operations skip this printing entirely.
-- Only the individual per-printing PATCH endpoint can update a locked card.

ALTER TABLE printings
  ADD COLUMN foil_inset_locked boolean NOT NULL DEFAULT false;
