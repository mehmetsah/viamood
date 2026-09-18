-- FAZ 4 — Reklam önerileri + Influencer platformu. Additive/güvenli, idempotent.
-- Elle yazıldı (db:generate kırık — bkz. 0008). Canlı sipariş/fulfillment akışına dokunmaz.

DO $$ BEGIN
  CREATE TYPE "ad_suggestion_status" AS ENUM ('open','scored','approved','rejected','meta_ready','published','done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ad_vote" AS ENUM ('yes','no');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ad_collab_type" AS ENUM ('existing_video','collaboration');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ad_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "suggested_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" "ad_suggestion_status" NOT NULL DEFAULT 'open',
  "reason" text,
  "collab_type" "ad_collab_type",
  "video_url" text,
  "video_note" text,
  "score_pct" integer,
  "finalized_at" timestamptz,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "ad_suggestions_product_idx" ON "ad_suggestions" ("product_id");
CREATE INDEX IF NOT EXISTS "ad_suggestions_status_idx" ON "ad_suggestions" ("status");

CREATE TABLE IF NOT EXISTS "ad_suggestion_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "suggestion_id" uuid NOT NULL REFERENCES "ad_suggestions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "vote" "ad_vote" NOT NULL,
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "ad_vote_suggestion_user_uq" UNIQUE ("suggestion_id","user_id")
);
CREATE INDEX IF NOT EXISTS "ad_votes_suggestion_idx" ON "ad_suggestion_votes" ("suggestion_id");

CREATE TABLE IF NOT EXISTS "influencers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "handle" text NOT NULL,
  "instagram_url" text NOT NULL,
  "display_name" text,
  "follower_count" integer,
  "notes" text,
  "added_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "influencers_handle_uq" UNIQUE ("handle")
);

CREATE TABLE IF NOT EXISTS "ad_suggestion_influencers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "suggestion_id" uuid NOT NULL REFERENCES "ad_suggestions"("id") ON DELETE CASCADE,
  "influencer_id" uuid NOT NULL REFERENCES "influencers"("id") ON DELETE CASCADE,
  "added_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "ad_sug_inf_uq" UNIQUE ("suggestion_id","influencer_id")
);
CREATE INDEX IF NOT EXISTS "ad_sug_inf_suggestion_idx" ON "ad_suggestion_influencers" ("suggestion_id");
