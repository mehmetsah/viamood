-- Tedarikçi → KargoLab üyesi eşleşmesi
--
-- Her tedarikçi, Via Mood'un kendi tenant'ında (kargo.viamood.com.tr,
-- system_number 71940835) AYRI bir üye olarak açılır. Bu alanlar o üyenin
-- numarasını ve senkron durumunu tutar.
--
-- NOT: kargolab_member_id BOŞ olabilir — tedarikçi henüz KargoLab'e
-- kaydedilmemiş demektir (panelde kargo/cari bölümü kapalı gelir).
-- Üye açma best-effort çalışır; hata olursa kargolab_sync_error dolar ve
-- tedarikçi onayı geri alınmaz.

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "kargolab_member_id" integer;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "kargolab_synced_at" timestamp with time zone;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "kargolab_sync_error" text;

-- Aynı KargoLab üyesinin iki tedarikçiye bağlanması çift cari demektir; engelle.
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_kargolab_member_id_uq"
  ON "vendors" ("kargolab_member_id")
  WHERE "kargolab_member_id" IS NOT NULL;
