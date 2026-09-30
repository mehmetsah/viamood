-- #992317 · DAVET (ilk giriş) linki tablosu.
-- `password_reset_tokens`'ın kardeşi: ham token saklanmaz (yalnız SHA-256 özeti),
-- 24 saatlik süre `expires_at`te, tek kullanım `used_at` damgasıyla.
-- İdempotent: deploy betiği bu dosyayı yeniden koşabilir (DEVIR.md §3).
CREATE TABLE IF NOT EXISTS "invite_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "invited_by" uuid,
  "request_ip" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invite_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_invited_by_users_id_fk"
    FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_tokens_email_created_idx"
  ON "invite_tokens" USING btree ("email","created_at");
