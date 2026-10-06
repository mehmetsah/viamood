-- #991676 — Otomatik e-posta akışları: tetik · zamanlanmış gönderim · kişiye özel kupon.
--
-- ⚠ TAMAMEN FİKİR-TEKRARLI (idempotent). Sebep ölçüldü (#992334-E, 2 Eki 2026):
-- 0007_shipping_rates `CREATE TYPE` kullandığı için ikinci koşuda
-- "type already exists" ile patladı ve göç listesini kilitledi. Postgres'te
-- `CREATE TYPE IF NOT EXISTS` YOKTUR — bu yüzden burada enum tipi HİÇ
-- kullanılmadı, durum/akış alanları `text` + kod tarafı doğrulaması.
-- Bu dosya scripts/deploy.sh otomatik listesine (ls drizzle/*.sql | sort -V) girer.

CREATE TABLE IF NOT EXISTS eposta_akis_tetikleri (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  akis          text NOT NULL,
  email         text NOT NULL,
  cart_id       uuid,
  tetik_ani     timestamptz NOT NULL DEFAULT now(),
  iys_onayi     boolean NOT NULL DEFAULT false,
  iptal_sebebi  text,
  iptal_ani     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eposta_akis_tetikleri_email_idx ON eposta_akis_tetikleri (email, tetik_ani);
CREATE INDEX IF NOT EXISTS eposta_akis_tetikleri_akis_idx  ON eposta_akis_tetikleri (akis, tetik_ani);

CREATE TABLE IF NOT EXISTS eposta_akis_gonderimleri (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tetik_id      uuid NOT NULL REFERENCES eposta_akis_tetikleri (id) ON DELETE CASCADE,
  adim          integer NOT NULL,
  planlanan_an  timestamptz NOT NULL,
  durum         text NOT NULL DEFAULT 'planlandi',
  kanal         text NOT NULL DEFAULT 'eposta',
  kupon_id      uuid,
  gonderim_ani  timestamptz,
  hata_metni    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- ÇİFT MAİL FRENİ: kuyruk işi iki kez çalışsa bile ikinci INSERT düşer.
  CONSTRAINT eposta_akis_gonderimleri_tetik_adim_uq UNIQUE (tetik_id, adim)
);

CREATE INDEX IF NOT EXISTS eposta_akis_gonderimleri_planlanan_idx
  ON eposta_akis_gonderimleri (durum, planlanan_an);

CREATE TABLE IF NOT EXISTS eposta_kuponlari (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod                  text NOT NULL UNIQUE,
  email                text NOT NULL,
  akis                 text NOT NULL,
  indirim_yuzde        integer NOT NULL,
  ust_limit_kurus      integer,
  bitis_ani            timestamptz NOT NULL,
  kullanildi_ani       timestamptz,
  kullanilan_siparis_id uuid,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 60 GÜN FRENİ bu indeksle sorulur.
CREATE INDEX IF NOT EXISTS eposta_kuponlari_email_created_idx ON eposta_kuponlari (email, created_at);
