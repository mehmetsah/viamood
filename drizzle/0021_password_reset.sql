-- 0021_password_reset — "Şifremi unuttum" akışı için tek kullanımlık token tablosu.
-- Yunus test raporu 10 Eyl 13:53, madde 1.
--
-- İdempotent (deploy hattı numaralı SQL'leri HER deploy'da yeniden koşar).
--
-- Tasarım notları:
--  * token_hash: linkteki ham token DEĞİL, SHA-256 özeti saklanır. DB sızarsa
--    kimse kimsenin şifresini sıfırlayamaz.
--  * user_id NULL olabilir: kayıtlı olmayan bir e-posta için de satır yazılır ki
--    hız sınırı (rate limit) çalışsın ve "bu e-posta kayıtlı mı" bilgisi
--    davranış farkından SIZMASIN. user_id NULL satır asla tüketilemez.
--  * used_at: tüketilince damgalanır → token tek kullanımlık.

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

-- Token ile arama (doğrulama yolu) — aynı özet iki kez yazılmasın.
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_uq"
  ON "password_reset_tokens" ("token_hash");

-- Hız sınırı sorguları: e-posta + zaman, IP + zaman.
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_created_idx"
  ON "password_reset_tokens" ("email", "created_at");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_ip_created_idx"
  ON "password_reset_tokens" ("request_ip", "created_at");
