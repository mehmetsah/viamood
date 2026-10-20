-- #994753 · webhook ölü mektup REPLAY ayağı.
-- Geri alma: üç kolon da DROP edilebilir; veri kaybı olmaz (hepsi türetilmiş durum).
-- Idempotent: aynı migration iki kez koşarsa hata vermez.
ALTER TABLE webhook_olu_mektup ADD COLUMN IF NOT EXISTS deneme_sayisi integer NOT NULL DEFAULT 0;
ALTER TABLE webhook_olu_mektup ADD COLUMN IF NOT EXISTS son_deneme_ts timestamptz;
ALTER TABLE webhook_olu_mektup ADD COLUMN IF NOT EXISTS elle_inceleme boolean NOT NULL DEFAULT false;

-- Replay taraması: açık (islendi_ts NULL) + otomatiğe kapalı olmayan + geçici hatalar.
CREATE INDEX IF NOT EXISTS webhook_olu_mektup_replay_idx
  ON webhook_olu_mektup (kalici, elle_inceleme, islendi_ts, son_deneme_ts);
