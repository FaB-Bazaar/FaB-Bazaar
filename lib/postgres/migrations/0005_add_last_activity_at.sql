ALTER TABLE "binders" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "deck_cards" DROP COLUMN "pitch";--> statement-breakpoint
CREATE INDEX "idx_binders_last_activity_at" ON "binders" USING btree ("last_activity_at");
