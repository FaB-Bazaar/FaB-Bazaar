-- Add parent_id to curated_lists (null = top-level list)
ALTER TABLE "curated_lists" ADD COLUMN "parent_id" text REFERENCES "curated_lists"("id") ON DELETE CASCADE;
CREATE INDEX "idx_curated_lists_parent_id" ON "curated_lists" ("parent_id");

-- Replace card_name with printing_id on curated_list_cards
ALTER TABLE "curated_list_cards" DROP COLUMN "card_name";
ALTER TABLE "curated_list_cards" ADD COLUMN "printing_id" text NOT NULL DEFAULT '';
ALTER TABLE "curated_list_cards" ALTER COLUMN "printing_id" DROP DEFAULT;
