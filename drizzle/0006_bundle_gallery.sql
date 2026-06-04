-- Bundle galeri görselleri:
-- Ana görsel (featured_image_url) manuel girilir, galeri seçilen ürünlerin
-- görsellerinden otomatik türetilir. Manuel override edilebilir.

ALTER TABLE "product_bundles"
  ADD COLUMN IF NOT EXISTS "gallery_image_urls" jsonb NOT NULL DEFAULT '[]'::jsonb;
