-- #994914 · E-posta akışı SABİT KUPON modu (Yunus 22 Eki: «HOSGELDIN10 şeklinde kod açtım»).
-- Aynı sabit kod birden çok müşteriye ve aynı müşteriye farklı tarihlerde verilir;
-- her veriliş AYRI satırdır (60 gün freni satırın created_at'inden okunur — upsert
-- bu tarihi ezip freni gevşetirdi). Bu yüzden `kod` üzerindeki tam tekillik kalkar,
-- yerine YALNIZ kişisel kodlarda (HG-/ST-/CT-) kısmi tekillik konur.
-- Veri kaybı YOK, kolon düşürme YOK. İDEMPOTENT: deploy her koşuda tüm göçleri koşar.
ALTER TABLE eposta_kuponlari DROP CONSTRAINT IF EXISTS eposta_kuponlari_kod_key;
CREATE UNIQUE INDEX IF NOT EXISTS eposta_kuponlari_kod_kisisel_uniq
  ON eposta_kuponlari (kod) WHERE kod ~ '^(HG|ST|CT)-';
CREATE INDEX IF NOT EXISTS eposta_kuponlari_kod_email_idx ON eposta_kuponlari (kod, email);
