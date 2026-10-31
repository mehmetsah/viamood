#!/bin/bash
# #994831 · AÇIKLAMASI BAŞKA ÜRÜNÜ ANLATAN 2 ÜRÜN (Rock Jaw · Thrash vs Terrack; yanlış metin kaldırılır, kaynaklı metin yazılır; ÖNCESİ HTML kütükte) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-degistir.mts — şüphede ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-degistir" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-degistir.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-degistir.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-degistir.jsonl --kutuk=$LOG_DIR/994831-aciklama-degistir-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-degistir.jsonl --uygula --kutuk=$LOG_DIR/994831-aciklama-degistir-uygula.jsonl}"
exit 0
