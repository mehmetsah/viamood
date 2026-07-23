-- 0017_goknil_upsert — Göknil kullanıcısını GARANTİ oluştur/güncelle (bilinen şifre).
-- Neden: 0015/0016 deploy'unda kullanıcı DB'ye düşmemiş olabilir (login CredentialsSignin).
-- UPSERT: yoksa oluşturur, varsa (yalnız bilinen eski hash'lerdeyse) bilinen yeni şifreye çeker.
-- Göknil kendi şifresini sonradan değiştirirse (hash bilinenlerden farklı) DOKUNMAZ. Her deploy idempotent.
-- Düz şifre repoda/raporda YOK; Mehmet'e ayrı iletildi.
INSERT INTO "users" ("name","email","password_hash","role")
VALUES ('Göknil','goknil@viamood.com.tr','$2b$12$zRLz0swIUVNRgJGwV/QNbekDmAyVxjgTbHoJ.OUqtlHGodtVLk4mq','admin')
ON CONFLICT ("email") DO UPDATE
  SET "password_hash" = EXCLUDED."password_hash", "role" = 'admin'
  WHERE "users"."password_hash" IN ('$2b$12$mLoR2bZkoCCdx1RQ96t13um2uw8eX8UAQ3yi7xsfP9mQcGFezxqMm','$2b$12$yxcypEpT3awpgDUWqLkXfuzBDtcJ7qy8PCy.cpZMWQCVF/52vmukq','$2b$12$mLoR2bZkoCCdx1RQ96t13um2uw8eX8UAQ3yi7xsfP9mQcGFezxqMm');
