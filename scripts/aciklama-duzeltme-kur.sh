#!/bin/bash
# #994831 · İKİ AÇIKLAMA DÜZELTMESİ (100 LT 2'li set · kare çerezlik 235 ml; başlık DEĞİŞMEZ) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-duzeltme.mts — şüphede ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-duzeltme" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-duzeltme.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-duzeltme.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-duzeltme.mts --kutuk=$LOG_DIR/994831-aciklama-duzeltme-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-duzeltme.mts --uygula --kutuk=$LOG_DIR/994831-aciklama-duzeltme-uygula.jsonl}"
exit 0
