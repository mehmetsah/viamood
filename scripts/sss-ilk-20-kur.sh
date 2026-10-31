#!/bin/bash
# #994831 · İLK 20 ÜRÜNE SSS YAZIMI — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-sss-ilk-20.jsonl (sahip onayı 23 Eki 2026). Betik: scripts/sss-ice-aktar.mts —
# kapıları (yalnız SSS'i BOŞ ürüne yazar, aynı küme "zaten-yazili", farklı SSS "ezilmez") DEĞİŞMEDİ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-ilk-20" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-ilk20.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-ilk20.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-ilk-20.jsonl --kutuk=$LOG_DIR/994831-sss-ilk20-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-ilk-20.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-ilk20-uygula.jsonl}"
exit 0
