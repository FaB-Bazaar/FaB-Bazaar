ALTER TABLE "users" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_iv" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_password_pre_hashed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_avatar" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mcp_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mcp_token_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "client_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_content_creator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_manage_locations" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_import_card_collections" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_moderate_forums" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_local_gaming_store" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_patreon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_shop" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_tcg_seller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_email_hash" ON "users" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "idx_users_mcp_token" ON "users" USING btree ("mcp_token");