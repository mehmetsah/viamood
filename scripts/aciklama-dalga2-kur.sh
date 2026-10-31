#!/bin/bash
# #994831 · KAYNAKLI AÇIKLAMA DALGA 2 (6 ürün; kalite kapısı; kısa açıklamada mevcut metin korunur) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-ekle.mts — şüphede ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-dalga2" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-dalga2.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-dalga2.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-ekle.mts veri/994831-aciklama-dalga2.jsonl --kalite --kutuk=$LOG_DIR/994831-aciklama-dalga2-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-ekle.mts veri/994831-aciklama-dalga2.jsonl --kalite --uygula --kutuk=$LOG_DIR/994831-aciklama-dalga2-uygula.jsonl}"
exit 0
