-- #991833 · Ürün bazlı SSS (Yunus, 27 Eyl 2026)
-- Ürün anahtarı `handle`: tema ve native vitrin ürünü handle ile tanıyor;
-- sayısal id seçmek Shopify(gid)↔native(numerik) ayrışmasını bu tabloya taşırdı.
CREATE TABLE IF NOT EXISTS "urun_sss" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "urun_handle"  text NOT NULL,
  "soru"         text NOT NULL,
  "cevap"        text NOT NULL,
  "sira"         integer NOT NULL DEFAULT 0,
  "acik"         boolean NOT NULL DEFAULT true,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "urun_sss_handle_idx" ON "urun_sss" ("urun_handle");
-- Aynı üründe iki kayıt aynı sırada duramaz (ekran sırası belirsiz kalmasın).
ALTER TABLE "urun_sss" DROP CONSTRAINT IF EXISTS "urun_sss_handle_sira_uq";
ALTER TABLE "urun_sss" ADD CONSTRAINT "urun_sss_handle_sira_uq" UNIQUE ("urun_handle","sira");
