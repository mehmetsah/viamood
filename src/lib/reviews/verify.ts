/**
 * Yorum ucu imza doğrulaması. Gerçek uygulama #994753 · R3 ile tek kaynağa
 * taşındı: `@/lib/storefront/imza`. Burada yalnız yeniden ihraç var ki iki uç
 * (adresler · yorumlar) AYNI kuralı kullansın — ölçülen arıza tam olarak bu iki
 * ucun ayrışmasıydı. Bu dosya korunuyor çünkü mevcut çiviler onu içe alıyor.
 */
export { imzaGecerliMi, imzaAdaylari, EN_AZ_ANAHTAR_UZUNLUGU } from '@/lib/storefront/imza';
