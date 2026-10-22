-- #994816 — e-posta akışı kuponu artık Shopify'da da açılıyor (kişiye özel,
-- tek kullanımlık). Shopify indirim düğümünün kimliği iz olarak tutulur:
-- denetim ("bu kod Shopify'da hangi indirim?") ve gerekirse kapatma için.
-- FİKİR-TEKRARLI: ikinci koşu hata vermez (0031'in notu).
ALTER TABLE eposta_kuponlari ADD COLUMN IF NOT EXISTS shopify_indirim_id text;
