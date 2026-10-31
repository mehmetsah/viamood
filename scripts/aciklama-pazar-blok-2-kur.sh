#!/bin/bash
# #994831 · DALGA 6 · KALAN SHOPIFY İÇ BLOKLARI (Shopify Ürün Organizasyonu · Kategori · Kategori Meta Alanları) + SOHBET ARTIĞI — ilk koşunun damgası ayrı kaldığı için YENİ damga. Damgalı, tek seferlik, best-effort.
# Kaynak: canlı açıklamalar. Betik: scripts/aciklama-pazar-blok.mts — şüpheli kuyrukta ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-pazar-blok-2" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-pazar-blok-2.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-pazar-blok-2.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-pazar-blok.mts --kutuk=$LOG_DIR/994831-pazar-blok-2-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-pazar-blok.mts --uygula --kutuk=$LOG_DIR/994831-pazar-blok-2-uygula.jsonl}"
exit 0
