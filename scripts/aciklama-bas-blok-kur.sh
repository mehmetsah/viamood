#!/bin/bash
# #994831 · DALGA 7 · AÇIKLAMA BAŞINDAKİ İÇ BAŞLIKLAR («Ürün Başlığı» + ad satırı · «Shopify Ürün Açıklaması») — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Kaynak: canlı açıklamalar. Betik: scripts/aciklama-bas-blok.mts — şüpheli baş dizide ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-bas-blok" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-bas-blok.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-bas-blok.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-bas-blok.mts --kutuk=$LOG_DIR/994831-bas-blok-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-bas-blok.mts --uygula --kutuk=$LOG_DIR/994831-bas-blok-uygula.jsonl}"
exit 0
