-- 0017_goknil_upsert — Göknil admin kullanıcısını GARANTİ oluştur + şifresini BİLİNEN değere sabitle.
-- Neden düzeltme: 0015/0016/0017 üç farklı hash üretiyordu; en son çalışan eski 0017 DB'yi düz metni
-- HİÇBİR YERDE OLMAYAN bir hash'e (zRLz…) çekiyordu → Mehmet'e iletilen bilinen şifre ile login FAİL.
-- Bu sürüm DB'yi TEK bilinen değere (yxcy…) oturtur; düz şifre Mehmet'e ayrı iletildi (repoda/raporda YOK).
--
-- KOŞULSUZ (guard YOK): önceki guard'lı sürümler DB'yi düz metni bilinmeyen bir hash'te bırakmış
-- olabilir → giriş FAİL. Tek adanmış panel hesabı (goknil@viamood.com.tr) olduğundan hash'i her
-- deploy'da DOĞRUDAN bilinen değere (yxcy… = 'Orkide-Gunes-8831%') sabitliyoruz. Kullanıcı yoksa oluşturur.
-- IS DISTINCT FROM ile: hash zaten doğruysa yazma yapılmaz (gereksiz write churn yok), idempotent.
-- NOT: Göknil panelden şifresini değiştirirse bir sonraki deploy geri alır → o gün bu migration nötrlenmeli.
INSERT INTO "users" ("name","email","password_hash","role")
VALUES ('Göknil','goknil@viamood.com.tr','$2b$12$yxcypEpT3awpgDUWqLkXfuzBDtcJ7qy8PCy.cpZMWQCVF/52vmukq','admin')
ON CONFLICT ("email") DO UPDATE
  SET "password_hash" = EXCLUDED."password_hash", "role" = 'admin'
  WHERE "users"."password_hash" IS DISTINCT FROM EXCLUDED."password_hash"
     OR "users"."role" IS DISTINCT FROM 'admin';
