-- Migration: Backfill cards.{format}_banned from banned_cards registry
--
-- The deck-builder search reads the denormalized cards.{format}_banned columns,
-- but the admin UI mutates the banned_cards registry. Toggling status_active
-- in the registry never wrote through to the cards columns, so unbans (e.g.
-- Amulet of Ice in Silver Age, deactivated 2026-03-03) silently failed to
-- propagate. This migration reconciles the two sources for all formats that
-- have a denormalized column.
--
-- A card is banned in a format iff there exists at least one
-- restriction_type='banned' row with status_active=true for that (card, format).
-- Going forward, PostgresBannedCardsService.recomputeCardsBannedFlag keeps the
-- two in sync on every mutation.

UPDATE cards c
SET silver_age_banned = EXISTS (
  SELECT 1 FROM banned_cards bc
  WHERE bc.card_unique_id = c.card_unique_id
    AND bc.format = 'silver_age'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
);

UPDATE cards c
SET cc_banned = EXISTS (
  SELECT 1 FROM banned_cards bc
  WHERE bc.card_unique_id = c.card_unique_id
    AND bc.format = 'classic_constructed'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
);

UPDATE cards c
SET ll_banned = EXISTS (
  SELECT 1 FROM banned_cards bc
  WHERE bc.card_unique_id = c.card_unique_id
    AND bc.format = 'living_legend'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
);

UPDATE cards c
SET blitz_banned = EXISTS (
  SELECT 1 FROM banned_cards bc
  WHERE bc.card_unique_id = c.card_unique_id
    AND bc.format = 'blitz'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
);

UPDATE cards c
SET commoner_banned = EXISTS (
  SELECT 1 FROM banned_cards bc
  WHERE bc.card_unique_id = c.card_unique_id
    AND bc.format = 'commoner'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
);
