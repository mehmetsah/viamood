-- 0026_veri_silme — Facebook (Meta) "Data Deletion Request" talepleri.
--
-- NEDEN: Facebook Login için Meta, uygulamadan "kullanıcı verisi silme callback
-- URL'i" istiyor. Uç: /api/auth/facebook/data-deletion. Meta'nın protokolü,
-- her talebe takip edilebilir bir confirmation_code + durum URL'i ister; bu
-- tablo o talebin kaydı ve durum sayfasının (/veri-silme-durumu) kaynağıdır.
--
-- İdempotent (deploy hattı numaralı SQL'leri her deploy'da tekrar koşar).
CREATE TABLE IF NOT EXISTS "veri_silme_talepleri" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kod" text NOT NULL,
  "provider" text DEFAULT 'facebook' NOT NULL,
  "provider_user_id" text NOT NULL,
  "user_id" text,
  "durum" text DEFAULT 'alindi' NOT NULL,
  "detay" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "veri_silme_talepleri_kod_unique" UNIQUE("kod")
);
CREATE INDEX IF NOT EXISTS "veri_silme_provider_user_idx"
  ON "veri_silme_talepleri" ("provider", "provider_user_id");
