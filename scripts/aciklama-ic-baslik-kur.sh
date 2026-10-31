#!/bin/bash
# #994831 · POLA İÇ BAŞLIK TEMİZLİĞİ (54 aktif ürün: Ürün Başlığı · Shopify Ürün Açıklaması · "Görsellerde doğrulandığı üzere") — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Kaynak: canlı açıklamalar. Betik: scripts/aciklama-ic-baslik.mts —
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-ic-baslik" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-ic-baslik.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-ic-baslik.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-ic-baslik.mts --kutuk=$LOG_DIR/994831-ic-baslik-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-ic-baslik.mts --uygula --kutuk=$LOG_DIR/994831-ic-baslik-uygula.jsonl}"
exit 0
