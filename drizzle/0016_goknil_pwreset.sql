-- 0016_goknil_pwreset — Göknil şifresini BİLİNEN güvenli değere tek-seferlik reset.
-- Neden: 0015'teki düz şifre hiçbir yere yazılmadı (bcrypt tek yönlü) → Mehmet'e iletilebilmesi için
-- yeni, bilinen bir değere alındı. Düz şifre repoda/raporda YOK; Mehmet'e sohbetten ayrı verildi.
--
-- Tek-seferlik + idempotent + güvenli guard: UPDATE yalnızca hash HÂLÂ 0015'teki orijinal değerken çalışır.
-- İlk deploy'da tetiklenir → hash yeni değere döner → koşul bir daha ASLA tutmaz (her deploy no-op).
-- Göknil ileride şifresini kendisi değiştirirse hash eskiyle eşleşmez → değişikliği EZMEZ.
UPDATE "users"
SET "password_hash" = '$2b$12$yxcypEpT3awpgDUWqLkXfuzBDtcJ7qy8PCy.cpZMWQCVF/52vmukq'
WHERE "email" = 'goknil@viamood.com.tr'
  AND "password_hash" = '$2b$12$mLoR2bZkoCCdx1RQ96t13um2uw8eX8UAQ3yi7xsfP9mQcGFezxqMm';
