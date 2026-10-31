#!/bin/bash
# #994995 · İÇ NOT TEMİZLİĞİ (Hello Kitty HKT11000 + Kuromi KU007) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Kaynak: veri/994995-aciklama/ (ÖNCESİ + onaylı TASLAK + manifest md5). Betik: scripts/aciklama-ic-not.mts —
# canlı ≠ ÖNCESİ ise YAZMAZ; taslak yeni metin içerirse YAZMAZ.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-ic-not" \
  "${DAMGA:-/var/www/viamood-extras/994995-aciklama-ic-not.damga}" \
  "${LOG:-$LOG_DIR/994995-aciklama-ic-not.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-ic-not.mts --kutuk=$LOG_DIR/994995-ic-not-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-ic-not.mts --uygula --kutuk=$LOG_DIR/994995-ic-not-uygula.jsonl}"
exit 0
