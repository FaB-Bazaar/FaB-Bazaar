CREATE TYPE "public"."condition" AS ENUM('NM', 'LP', 'MP', 'HP', 'DMG');--> statement-breakpoint
CREATE TYPE "public"."deck_category" AS ENUM('hero', 'equipment', 'maindeck', 'sideboard', 'inventory');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."visibility_level" AS ENUM('public', 'private', 'friends', 'unlisted');--> statement-breakpoint
CREATE TABLE "binders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"visibility_level" "visibility_level" DEFAULT 'public',
	"allow_in_search" boolean DEFAULT true NOT NULL,
	"allow_in_matching" boolean DEFAULT true NOT NULL,
	"allow_discord_commands" boolean DEFAULT true NOT NULL,
	"allow_api_export" boolean DEFAULT true NOT NULL,
	"allow_who_has" boolean DEFAULT true NOT NULL,
	"allow_webhooks" boolean DEFAULT false NOT NULL,
	"stats_need_update" boolean DEFAULT true NOT NULL,
	"stats_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"card_unique_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"text" text,
	"searchable_text" text,
	"type_text" text,
	"type_text_display" text,
	"types" text[],
	"traits" text[],
	"keywords" text[],
	"abilities" text[],
	"classes" text[],
	"talents" text[],
	"power" integer,
	"power_text" text,
	"cost" integer,
	"cost_text" text,
	"defense" integer,
	"defense_text" text,
	"pitch" integer,
	"pitch_text" text,
	"health" integer,
	"intelligence" integer,
	"color" text,
	"is_action" boolean DEFAULT false NOT NULL,
	"is_attack" boolean DEFAULT false NOT NULL,
	"is_defense_reaction" boolean DEFAULT false NOT NULL,
	"is_instant" boolean DEFAULT false NOT NULL,
	"is_equipment" boolean DEFAULT false NOT NULL,
	"is_weapon" boolean DEFAULT false NOT NULL,
	"is_hero" boolean DEFAULT false NOT NULL,
	"is_mentor" boolean DEFAULT false NOT NULL,
	"is_token" boolean DEFAULT false NOT NULL,
	"played_horizontally" boolean DEFAULT false NOT NULL,
	"is_generic" boolean DEFAULT false NOT NULL,
	"is_brute" boolean DEFAULT false NOT NULL,
	"is_guardian" boolean DEFAULT false NOT NULL,
	"is_mechanologist" boolean DEFAULT false NOT NULL,
	"is_ranger" boolean DEFAULT false NOT NULL,
	"is_runeblade" boolean DEFAULT false NOT NULL,
	"is_assassin" boolean DEFAULT false NOT NULL,
	"is_warrior" boolean DEFAULT false NOT NULL,
	"is_ninja" boolean DEFAULT false NOT NULL,
	"is_wizard" boolean DEFAULT false NOT NULL,
	"is_merchant" boolean DEFAULT false NOT NULL,
	"is_bard" boolean DEFAULT false NOT NULL,
	"is_adjudicator" boolean DEFAULT false NOT NULL,
	"is_illusionist" boolean DEFAULT false NOT NULL,
	"is_thief" boolean DEFAULT false NOT NULL,
	"is_shapeshifter" boolean DEFAULT false NOT NULL,
	"is_necromancer" boolean DEFAULT false NOT NULL,
	"has_chaos" boolean DEFAULT false NOT NULL,
	"has_light" boolean DEFAULT false NOT NULL,
	"has_royal" boolean DEFAULT false NOT NULL,
	"has_draconic" boolean DEFAULT false NOT NULL,
	"has_lightning" boolean DEFAULT false NOT NULL,
	"has_shadow" boolean DEFAULT false NOT NULL,
	"has_earth" boolean DEFAULT false NOT NULL,
	"has_mystic" boolean DEFAULT false NOT NULL,
	"has_revered" boolean DEFAULT false NOT NULL,
	"has_ice" boolean DEFAULT false NOT NULL,
	"has_reviled" boolean DEFAULT false NOT NULL,
	"has_pirate" boolean DEFAULT false NOT NULL,
	"has_elemental" boolean DEFAULT false NOT NULL,
	"is_generic_only" boolean DEFAULT false NOT NULL,
	"has_class_and_talent" boolean DEFAULT false NOT NULL,
	"has_class_only" boolean DEFAULT false NOT NULL,
	"has_talent_only" boolean DEFAULT false NOT NULL,
	"blitz_legal" boolean DEFAULT false NOT NULL,
	"cc_legal" boolean DEFAULT false NOT NULL,
	"commoner_legal" boolean DEFAULT false NOT NULL,
	"ll_legal" boolean DEFAULT false NOT NULL,
	"silver_age_legal" boolean DEFAULT false NOT NULL,
	"blitz_banned" boolean DEFAULT false NOT NULL,
	"cc_banned" boolean DEFAULT false NOT NULL,
	"commoner_banned" boolean DEFAULT false NOT NULL,
	"ll_banned" boolean DEFAULT false NOT NULL,
	"blitz_suspended" boolean DEFAULT false NOT NULL,
	"cc_suspended" boolean DEFAULT false NOT NULL,
	"commoner_suspended" boolean DEFAULT false NOT NULL,
	"ll_restricted" boolean DEFAULT false NOT NULL,
	"silver_age_banned" boolean DEFAULT false NOT NULL,
	"silver_age_suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"printing_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"category" "deck_category" NOT NULL,
	"pitch" integer
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"format" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"binder_id" text NOT NULL,
	"printing_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"condition" "condition" DEFAULT 'NM' NOT NULL,
	"language" text DEFAULT 'EN' NOT NULL,
	"notes" text,
	"for_trade" boolean DEFAULT false NOT NULL,
	"for_sale" boolean DEFAULT false NOT NULL,
	"acquisition_price" real,
	"acquisition_date" timestamp,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printings" (
	"printing_id" text PRIMARY KEY NOT NULL,
	"card_unique_id" text NOT NULL,
	"printing_card_id" text,
	"set_printing_unique_id" text,
	"collector_number" text,
	"set" text NOT NULL,
	"edition" text NOT NULL,
	"foiling" text NOT NULL,
	"rarity" text NOT NULL,
	"is_first_edition" boolean DEFAULT false NOT NULL,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"is_normal_edition" boolean DEFAULT false NOT NULL,
	"is_normal_foil" boolean DEFAULT false NOT NULL,
	"is_rainbow_foil" boolean DEFAULT false NOT NULL,
	"is_cold_foil" boolean DEFAULT false NOT NULL,
	"is_extended_art" boolean DEFAULT false NOT NULL,
	"is_common" boolean DEFAULT false NOT NULL,
	"is_rare" boolean DEFAULT false NOT NULL,
	"is_super_rare" boolean DEFAULT false NOT NULL,
	"is_majestic" boolean DEFAULT false NOT NULL,
	"is_legendary" boolean DEFAULT false NOT NULL,
	"is_fabled" boolean DEFAULT false NOT NULL,
	"is_promo" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"image_rotation_degrees" integer DEFAULT 0,
	"artists" text[],
	"flavor_text" text,
	"art_variations" text[],
	"tcgplayer_product_id" text,
	"tcgplayer_url" text,
	"tcgplayer_subtype_name" text,
	"tcg_market" real,
	"tcg_low" real,
	"tcg_mid" real,
	"tcg_high" real,
	"has_price" boolean DEFAULT false NOT NULL,
	"price_updated_at" timestamp,
	"is_budget" boolean DEFAULT false NOT NULL,
	"is_under_5" boolean DEFAULT false NOT NULL,
	"is_under_10" boolean DEFAULT false NOT NULL,
	"is_under_25" boolean DEFAULT false NOT NULL,
	"is_under_50" boolean DEFAULT false NOT NULL,
	"is_under_100" boolean DEFAULT false NOT NULL,
	"is_expensive" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"expansion_slot" boolean DEFAULT false NOT NULL,
	"content_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password_hash" text,
	"discord_id" text,
	"discord_username" text,
	"avatar_url" text,
	"country_code" text,
	"is_store" boolean DEFAULT false,
	"store_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "wants_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"printing_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"notes" text,
	"max_price" real,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binders" ADD CONSTRAINT "binders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_printing_id_printings_printing_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("printing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_binder_id_binders_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_printing_id_printings_printing_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("printing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printings" ADD CONSTRAINT "printings_card_unique_id_cards_card_unique_id_fk" FOREIGN KEY ("card_unique_id") REFERENCES "public"."cards"("card_unique_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wants_items" ADD CONSTRAINT "wants_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wants_items" ADD CONSTRAINT "wants_items_printing_id_printings_printing_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("printing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_binders_user_id" ON "binders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_binders_is_public" ON "binders" USING btree ("is_public") WHERE "binders"."is_public" = true;--> statement-breakpoint
CREATE INDEX "idx_binders_stats_dirty" ON "binders" USING btree ("stats_need_update") WHERE "binders"."stats_need_update" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_binders_user_name" ON "binders" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "idx_cards_name" ON "cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_cards_type_text" ON "cards" USING btree ("type_text");--> statement-breakpoint
CREATE INDEX "idx_deck_cards_deck_id" ON "deck_cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_deck_cards_printing_id" ON "deck_cards" USING btree ("printing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_deck_cards_deck_printing_category" ON "deck_cards" USING btree ("deck_id","printing_id","category");--> statement-breakpoint
CREATE INDEX "idx_decks_user_id" ON "decks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_decks_public" ON "decks" USING btree ("is_public") WHERE "decks"."is_public" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_decks_user_name" ON "decks" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "idx_inventory_user_id" ON "inventory_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_binder_id" ON "inventory_items" USING btree ("binder_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_printing_id" ON "inventory_items" USING btree ("printing_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_for_trade" ON "inventory_items" USING btree ("for_trade") WHERE "inventory_items"."for_trade" = true;--> statement-breakpoint
CREATE INDEX "idx_inventory_for_sale" ON "inventory_items" USING btree ("for_sale") WHERE "inventory_items"."for_sale" = true;--> statement-breakpoint
CREATE INDEX "idx_inventory_user_binder" ON "inventory_items" USING btree ("user_id","binder_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_user_printing" ON "inventory_items" USING btree ("user_id","printing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_inventory_binder_printing_condition_lang" ON "inventory_items" USING btree ("binder_id","printing_id","condition","language");--> statement-breakpoint
CREATE INDEX "idx_printings_card_id" ON "printings" USING btree ("card_unique_id");--> statement-breakpoint
CREATE INDEX "idx_printings_set" ON "printings" USING btree ("set");--> statement-breakpoint
CREATE INDEX "idx_printings_rarity" ON "printings" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "idx_printings_edition" ON "printings" USING btree ("edition");--> statement-breakpoint
CREATE INDEX "idx_printings_foiling" ON "printings" USING btree ("foiling");--> statement-breakpoint
CREATE INDEX "idx_printings_set_rarity" ON "printings" USING btree ("set","rarity");--> statement-breakpoint
CREATE INDEX "idx_users_discord_id" ON "users" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_wants_user_id" ON "wants_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_wants_printing_id" ON "wants_items" USING btree ("printing_id");--> statement-breakpoint
CREATE INDEX "idx_wants_priority" ON "wants_items" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_wants_user_printing" ON "wants_items" USING btree ("user_id","printing_id");