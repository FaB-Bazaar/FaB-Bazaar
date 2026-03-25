CREATE TABLE "curator_hero_assignments" (
  "user_id"           text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "hero_name"         text NOT NULL,
  "metafy_product_url" text,
  PRIMARY KEY ("user_id", "hero_name")
);

CREATE INDEX "idx_cha_user_id"   ON "curator_hero_assignments" ("user_id");
CREATE INDEX "idx_cha_hero_name" ON "curator_hero_assignments" ("hero_name");
