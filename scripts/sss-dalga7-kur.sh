#!/bin/bash
# #994831 · SSS DALGA 7 (69 ÜRÜN — teşhisin onaylı eksenleri + madde/anahtar-değer parça kabulü; cevaplar açıklamadan birebir) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-sss-dalga7.jsonl (31 Eki 2026; cevaplar açıklamanın cümlelerinden ya da madde/«Anahtar: değer» parçalarından birebir; eksen kapısı src/lib/sss-eksen.ts; kaynak anlık görüntüsü veri/994831-sss-dalga7-kaynak.jsonl, kargo/iade sorusu yok). Betik: scripts/sss-ice-aktar.mts —
# kapıları (yalnız SSS'i BOŞ ürüne yazar, aynı küme "zaten-yazili", farklı SSS "ezilmez") DEĞİŞMEDİ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-dalga7" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-dalga7.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-dalga7.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga7.jsonl --kutuk=$LOG_DIR/994831-sss-dalga7-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-ice-aktar.mts veri/994831-sss-dalga7.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-dalga7-uygula.jsonl}"
exit 0
