-- Migration: Add custom token cards and creator profiles
-- Fan-made unofficial token cards (e.g. creator-designed Ponder tokens) with creator attribution.
-- "Token card" is the FaB domain term (the card-game object), disambiguating from auth tokens.
-- Creators are tied 1:1 to a user account; token cards optionally link to cards.card_unique_id
-- so FaB metadata can be fetched via JOIN without duplication.

-- Creator profiles (1:1 with users)
CREATE TABLE "custom_token_card_creators" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "display_name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "bio" text,
  "avatar_url" text,
  "is_verified" boolean DEFAULT false NOT NULL,

  -- Contact / socials (full URLs; nullable)
  "website_url" text,
  "shop_url" text,
  "instagram_url" text,
  "facebook_url" text,
  "x_url" text,
  "bluesky_url" text,
  "discord_id" text,
  "discord_invite_url" text,

  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "idx_ctcc_user_id" ON "custom_token_card_creators" ("user_id");
CREATE INDEX "idx_ctcc_slug" ON "custom_token_card_creators" ("slug");

-- Custom token cards
CREATE TABLE "custom_token_cards" (
  "id" text PRIMARY KEY NOT NULL,
  "creator_id" text NOT NULL REFERENCES "custom_token_card_creators"("id") ON DELETE CASCADE,
  "card_unique_id" text REFERENCES "cards"("card_unique_id"),
  "external_id" text,
  "name" text NOT NULL,
  "description" text,
  "image_url" text,

  -- Link-out + optional self-reported stock
  "purchase_url" text,
  "in_stock" boolean,
  "stock_updated_at" timestamp,

  "is_published" boolean DEFAULT false NOT NULL,

  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "idx_ctc_creator_id" ON "custom_token_cards" ("creator_id");
CREATE INDEX "idx_ctc_card_unique_id" ON "custom_token_cards" ("card_unique_id");
CREATE INDEX "idx_ctc_is_published" ON "custom_token_cards" ("is_published");
