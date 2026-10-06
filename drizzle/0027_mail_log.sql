-- #991691 · Mail gönderim geçmişi + abonelikten çıkma (Yunus, 27 Eyl 2026)
-- Öncesinde bu depoda mail gönderimi için HİÇBİR log yoktu; "kime ne gönderdik"
-- sorusunun cevabı hiçbir yerde durmuyordu.

CREATE TABLE IF NOT EXISTS "mail_log" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "alici"         text NOT NULL,
  "konu"          text NOT NULL,
  "sablon"        text NOT NULL DEFAULT 'bilinmiyor',
  "tip"           text NOT NULL DEFAULT 'islemsel',
  "basarili"      boolean NOT NULL,
  "kanal"         text,
  "hata"          text,
  "saglayici_id"  text,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mail_log_created_idx" ON "mail_log" ("created_at");
CREATE INDEX IF NOT EXISTS "mail_log_alici_idx"   ON "mail_log" ("alici");
CREATE INDEX IF NOT EXISTS "mail_log_tip_idx"     ON "mail_log" ("tip");

-- E-posta PRIMARY KEY: aynı adres iki kez çıkamaz, tekrar tık hata vermez
-- (uç `onConflictDoNothing` ile idempotent).
CREATE TABLE IF NOT EXISTS "mail_abonelik_cikis" (
  "email"       text PRIMARY KEY,
  "kapsam"      text NOT NULL DEFAULT 'hepsi',
  "kaynak"      text NOT NULL DEFAULT 'link',
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mail_abonelik_cikis_created_idx" ON "mail_abonelik_cikis" ("created_at");
