-- 0024_password_reset — "Şifremi Unuttum" tek kullanımlık token tablosu.
-- İdempotent (deploy hattı numaralı SQL'leri HER deploy'da yeniden koşar).
--
-- token_hash: linkteki ham token DEĞİL, SHA-256 özeti. DB sızarsa kimse
-- kimsenin şifresini sıfırlayamaz.
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"    uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "email"      text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at"    timestamp with time zone,
  "request_ip" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_uq"
  ON "password_reset_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_created_idx"
  ON "password_reset_tokens" ("email", "created_at");
