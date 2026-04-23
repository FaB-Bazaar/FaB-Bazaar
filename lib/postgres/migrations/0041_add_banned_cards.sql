-- Migration: Add banned_cards table
-- Format-specific banned-card registry, mirroring the-fab-cube/flesh-and-blood-cards
-- banned-*.json files. Sourced upstream or maintained manually via the admin UI.
--
-- One row per (card_unique_id, format) pair. `status_active = false` rows are
-- preserved as history (e.g. unbanned cards) without firing the validator.
-- `source_unique_id` holds the upstream FaB JSON `unique_id` so we can diff
-- cleanly on re-sync.

CREATE TABLE "banned_cards" (
  "id" text PRIMARY KEY NOT NULL,
  "card_unique_id" text NOT NULL,
  "format" text NOT NULL,
  "source_unique_id" text,
  "status_active" boolean DEFAULT true NOT NULL,
  "date_announced" timestamp,
  "date_in_effect" timestamp,
  "legality_article" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "banned_cards_card_unique_id_format_unique" UNIQUE ("card_unique_id", "format"),
  CONSTRAINT "banned_cards_format_check" CHECK (
    "format" IN ('silver_age', 'classic_constructed', 'living_legend', 'blitz', 'commoner', 'clash', 'ultimate_pit_fight', 'draft', 'sealed', 'open')
  )
);

CREATE INDEX "banned_cards_format_active_idx" ON "banned_cards" ("format", "status_active");
CREATE INDEX "banned_cards_card_unique_id_idx" ON "banned_cards" ("card_unique_id");
