ALTER TABLE "curated_lists" ADD COLUMN "variant_type" text CHECK (variant_type IN ('budget', 'mid', 'premium'));
