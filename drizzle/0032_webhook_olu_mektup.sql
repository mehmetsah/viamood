-- #994753 · R1 — Shopify webhook ölü mektup kutusu.
-- Webhook ucu bir olayı işleyemediğinde ham gövde BURAYA yazılır; yanıt kodu
-- (kalıcı hata → 200, geçici hata → 503) veri kaybını belirlemez.
-- İdempotent: deploy betiği bu dosyayı yeniden koşabilir (DEVIR.md §3).
-- GERİ ALMA: DROP TABLE IF EXISTS "webhook_olu_mektup";  (başka tabloya bağlı
-- değildir, foreign key taşımaz — tek komutla geri alınır.)
CREATE TABLE IF NOT EXISTS "webhook_olu_mektup" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "konu" text NOT NULL,
  "webhook_id" text,
  "shop_domain" text,
  "kalici" boolean NOT NULL,
  "hata" text NOT NULL,
  "ham_govde" text,
  "islendi_ts" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_olu_mektup_konu_idx" ON "webhook_olu_mektup" ("konu");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_olu_mektup_acik_idx" ON "webhook_olu_mektup" ("islendi_ts");
