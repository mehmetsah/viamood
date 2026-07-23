-- 0017_goknil_upsert — Göknil admin kullanıcısını GARANTİ oluştur + şifresini BİLİNEN değere sabitle.
-- Neden düzeltme: 0015/0016/0017 üç farklı hash üretiyordu; en son çalışan eski 0017 DB'yi düz metni
-- HİÇBİR YERDE OLMAYAN bir hash'e (zRLz…) çekiyordu → Mehmet'e iletilen bilinen şifre ile login FAİL.
-- Bu sürüm DB'yi TEK bilinen değere (yxcy…) oturtur; düz şifre Mehmet'e ayrı iletildi (repoda/raporda YOK).
--
-- Idempotent + güvenli guard: yalnızca hash HÂLÂ makine-üretimi bilinen değerlerden biriyken günceller.
-- Göknil ileride şifresini kendisi değiştirirse (hash bilinenlerden farklı) DOKUNMAZ. Her deploy no-op'a düşer.
-- Kullanıcı yoksa oluşturur (yxcy… hash + role=admin).
INSERT INTO "users" ("name","email","password_hash","role")
VALUES ('Göknil','goknil@viamood.com.tr','$2b$12$yxcypEpT3awpgDUWqLkXfuzBDtcJ7qy8PCy.cpZMWQCVF/52vmukq','admin')
ON CONFLICT ("email") DO UPDATE
  SET "password_hash" = EXCLUDED."password_hash", "role" = 'admin'
  WHERE "users"."password_hash" IN (
    '$2b$12$mLoR2bZkoCCdx1RQ96t13um2uw8eX8UAQ3yi7xsfP9mQcGFezxqMm',  -- 0015 orijinal
    '$2b$12$yxcypEpT3awpgDUWqLkXfuzBDtcJ7qy8PCy.cpZMWQCVF/52vmukq',  -- 0016 (= bilinen şifre)
    '$2b$12$zRLz0swIUVNRgJGwV/QNbekDmAyVxjgTbHoJ.OUqtlHGodtVLk4mq'   -- eski 0017 (düz metni yok)
  );
