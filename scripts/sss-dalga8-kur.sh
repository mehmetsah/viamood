#!/bin/bash
# #994831 · SSS DALGA 8 (9 ÜRÜN — bu gece metni yazılan/düzeltilen ürünlerden SSS'i olmayanlar; cevaplar güncel açıklamadan birebir, eksen kapısı, asorti/karakter sorusu yok) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-sss-dalga8.jsonl (1 Kas 2026; kaynak anlık görüntüsü veri/994831-sss-dalga8-kaynak.jsonl; önceki SSS kümesi veri/994831-sss-dalga8-onceki.json, kargo/iade sorusu yok). Betik: scripts/sss-ice-aktar.mts —
# kapıları (yalnız SSS'i BOŞ ürüne yazar, aynı küme "zaten-yazili", farklı SSS "ezilmez") DEĞİŞMEDİ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-dalga8" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-dalga8.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-dalga8.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga8.jsonl --kutuk=$LOG_DIR/994831-sss-dalga8-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga8.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-dalga8-uygula.jsonl}"
exit 0
