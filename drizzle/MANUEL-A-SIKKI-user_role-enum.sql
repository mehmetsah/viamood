-- ⛔⛔ MEHMET ŞAH'IN ONAYI OLMADAN ÇALIŞTIRILMAZ ⛔⛔
--
-- #992119 · A ŞIKKI — `sss_editor` değerini `user_role` enum'una ekler.
--
-- ⚠ GERİ ALINAMAZ: PostgreSQL'de enum'a eklenen değer SİLİNEMEZ. Yanlış eklenirse
--   dönüş yolu yoktur; tipi baştan yaratıp tüm bağımlı kolonları taşımak gerekir.
--   Bu yüzden tavsiye edilen yol B şıkkıdır (drizzle/0029_user_yetkileri.sql) —
--   orada yetkiyi geri almak tek DELETE.
--
-- ⚠ Bu dosya BİLEREK `drizzle/` içinde numarasız duruyor: göç koşucusu onu
--   otomatik uygulamasın, yalnız elle çalıştırılabilsin diye.
--
-- Çalıştırma (yalnız onay sonrası):
--   psql "$DATABASE_URL" -f drizzle/MANUEL-A-SIKKI-user_role-enum.sql
--
-- Bu tur içinde HİÇBİR ortamda çalıştırılmadı (ne canlı ne deneme) — 29 Eyl 2026, Elif.

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'sss_editor';
