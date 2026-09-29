-- #992119-B · Kullanıcı yetkileri — GERİ ALINABİLİR yetki verme yolu (29 Eyl 2026)
--
-- Neden tablo, neden enum değil: `users.role` bir PostgreSQL enum'u ve PostgreSQL'de
-- enum'a eklenen değer GERİ ALINAMAZ (silinemez). Yanlış verilen bir rolü geri almanın
-- yolu yok; tabloda ise tek DELETE yeter. Ölçüldü: `pg_enum` içinde 'sss_editor' yok.
--
-- ROLLBACK (aşağıdaki `down` bloğu): tablo DROP edilir, şema ilk hâline döner.
-- Hiçbir mevcut tabloya kolon eklenmiyor, hiçbir enum genişletilmiyor.

CREATE TABLE IF NOT EXISTS "user_yetkileri" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "yetki"          text NOT NULL,
  "verildi_at"     timestamptz NOT NULL DEFAULT now(),
  "veren_user_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "user_yetkileri_uniq" UNIQUE ("user_id", "yetki")
);
CREATE INDEX IF NOT EXISTS "user_yetkileri_user_idx"  ON "user_yetkileri" ("user_id");
CREATE INDEX IF NOT EXISTS "user_yetkileri_yetki_idx" ON "user_yetkileri" ("yetki");

-- >>> DOWN (elle çalıştırılır, geri alınabilirliğin kanıtı):
-- DROP TABLE IF EXISTS "user_yetkileri";
