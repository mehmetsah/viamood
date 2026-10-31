#!/bin/bash
# #994831 · SSS DALGA 5 (48 ÜRÜN — pilot 50; kaynak GÖVDE CÜMLESİ, cevaplar açıklamadan birebir alıntı) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-sss-dalga5.jsonl (31 Eki 2026; cevaplar açıklamanın gövde cümlelerinden birebir, kaynak anlık görüntüsü veri/994831-sss-dalga5-kaynak.jsonl, kargo/iade sorusu yok). Betik: scripts/sss-ice-aktar.mts —
# kapıları (yalnız SSS'i BOŞ ürüne yazar, aynı küme "zaten-yazili", farklı SSS "ezilmez") DEĞİŞMEDİ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-dalga5" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-dalga5.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-dalga5.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga5.jsonl --kutuk=$LOG_DIR/994831-sss-dalga5-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga5.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-dalga5-uygula.jsonl}"
exit 0
