#!/bin/bash
# #994831 · SSS DALGA 4 (30 ÜRÜN — hedef 100, güvenli kaynak 30 ürün verdi) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-sss-dalga4.jsonl (31 Eki 2026; cevaplar ürünün teknik tablosundan birebir, kargo/iade sorusu yok). Betik: scripts/sss-ice-aktar.mts —
# kapıları (yalnız SSS'i BOŞ ürüne yazar, aynı küme "zaten-yazili", farklı SSS "ezilmez") DEĞİŞMEDİ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-dalga4" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-dalga4.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-dalga4.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga4.jsonl --kutuk=$LOG_DIR/994831-sss-dalga4-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga4.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-dalga4-uygula.jsonl}"
exit 0
