-- KargoLab üye açılışının TETİKLEYİCİSİ
--
-- Üye, tedarikçi "KargoLab ile çalışacak" olarak işaretlendiğinde açılır —
-- başvuru onaylandığında değil. Onaylanmış ama kargo anlaşması olmayan
-- tedarikçiye üye açmak boş cari hesap yaratırdı.
--
-- kargolab_contract_no: Via Mood üst sözleşmesi altında tedarikçiye verilen
-- alt sözleşme numarası (varsa, bilgi amaçlı).

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "kargolab_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "kargolab_contract_no" text;
