-- Migration: Add curator role and curated lists tables
-- Renames is_patreon → is_metafy_supporter, adds is_curator, creates curated_lists and curated_list_cards

-- Rename is_patreon to is_metafy_supporter
ALTER TABLE "users" RENAME COLUMN "is_patreon" TO "is_metafy_supporter";

-- Add curator role
ALTER TABLE "users" ADD COLUMN "is_curator" boolean DEFAULT false NOT NULL;

-- Curated lists table
CREATE TABLE "curated_lists" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "hero_name" text,
  "format" text,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Curated list cards table
CREATE TABLE "curated_list_cards" (
  "id" text PRIMARY KEY NOT NULL,
  "list_id" text NOT NULL REFERENCES "curated_lists"("id") ON DELETE CASCADE,
  "card_name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

-- Indexes
CREATE INDEX "idx_curated_lists_hero_name" ON "curated_lists" ("hero_name");
CREATE INDEX "idx_curated_lists_is_published" ON "curated_lists" ("is_published");
CREATE INDEX "idx_curated_list_cards_list_id" ON "curated_list_cards" ("list_id");
