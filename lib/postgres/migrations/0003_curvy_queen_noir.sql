CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"public_id" text NOT NULL,
	"slug" text,
	"content" text,
	"author_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"content_type" text NOT NULL,
	"categories" text[],
	"image" text,
	"sections" text,
	"is_user_article" boolean DEFAULT false NOT NULL,
	"hero_slug" text,
	"hero_class" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_author_id" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_articles_public_id" ON "articles" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_articles_slug" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_articles_status" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_articles_is_user" ON "articles" USING btree ("is_user_article");--> statement-breakpoint
CREATE INDEX "idx_articles_hero_slug" ON "articles" USING btree ("hero_slug");--> statement-breakpoint
CREATE INDEX "idx_articles_hero_class" ON "articles" USING btree ("hero_class");--> statement-breakpoint
CREATE INDEX "idx_articles_user_composite" ON "articles" USING btree ("is_user_article","author_id","status");