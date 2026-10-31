#!/bin/bash
# #994831 · BOŞ AÇIKLAMA PİLOTU UYGULAMA (5 ürün; yalnız 0 bayt açıklamaya yazar) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-ekle.mts — şüphede ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-pilot" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-pilot.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-pilot.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-ekle.mts veri/994831-aciklama-pilot.jsonl --kutuk=$LOG_DIR/994831-aciklama-pilot-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-ekle.mts veri/994831-aciklama-pilot.jsonl --uygula --kutuk=$LOG_DIR/994831-aciklama-pilot-uygula.jsonl}"
exit 0
