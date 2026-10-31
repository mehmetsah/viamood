#!/bin/bash
# #994831 · SSS DALGA 9 (16 ÜRÜN — SSS'İ HİÇ OLMAYAN 178 aktif üründen; cevaplar güncel açıklamadan birebir ya da tablo satırının kendisi «Anahtar: değer»; eksen kapısı; kargo/iade/cayma yok; asorti/karakter sorusu yok) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-sss-dalga9.jsonl (1 Kas 2026; kaynak anlık görüntüsü veri/994831-sss-dalga9-kaynak.jsonl; önceki SSS kümesi veri/994831-sss-dalga9-onceki.json). Betik: scripts/sss-ice-aktar.mts —
# kapıları (yalnız SSS'i BOŞ ürüne yazar, aynı küme "zaten-yazili", farklı SSS "ezilmez") DEĞİŞMEDİ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-dalga9" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-dalga9.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-dalga9.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga9.jsonl --kutuk=$LOG_DIR/994831-sss-dalga9-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga9.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-dalga9-uygula.jsonl}"
exit 0
