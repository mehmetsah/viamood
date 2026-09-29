-- FAZ 3.1 — Ürün stok konumu (bizim depo / tedarikçiden toplama / tedarikçi dropship).
-- Sipariş toplama-rota + fulfillment kararını besler. Additive/güvenli, idempotent.
-- Elle yazıldı (db:generate kırık — bkz. 0008). Varsayılan 'own_warehouse' → mevcut davranış korunur.

-- stock_location enum
DO $$ BEGIN
  CREATE TYPE "stock_location" AS ENUM ('own_warehouse', 'supplier_pickup', 'supplier_dropship');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- products.stock_location kolonu (varsayılan own_warehouse = mevcut auto-fulfill davranışı)
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "stock_location" "stock_location" NOT NULL DEFAULT 'own_warehouse';
