-- 0023_auth_social — Sosyal giriş (Google) kimliklerinin DB'de tutulması.
--
-- NEDEN: prod sunucuya SSH KAPALI (13.62.159.252:22) → .env düzenlenemiyor.
-- Kimlikler panelden HTTPS üzerinden girilebilsin diye store_settings'e
-- `auth` jsonb kolonu eklendi. Halköde ödeme kimlikleriyle AYNI desen.
--
-- İdempotent (deploy hattı numaralı SQL'leri her deploy'da tekrar koşar).
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "auth" jsonb NOT NULL DEFAULT '{}'::jsonb;
