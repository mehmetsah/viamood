#!/bin/bash
# #994831 · ADIM 2 · A2 İKİNCİ KOŞU — fiil ölçütü son sözcüğe taşındı (Sneaker/Super yanlış pozitifi); ilk koşunun damgası ayrı kaldığı için YENİ damga. Damgalı, tek seferlik, best-effort.
# Kaynak: canlı açıklamalar. Betik: scripts/aciklama-baslik-tekrar.mts —
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-baslik-tekrar-2" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-baslik-tekrar-2.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-baslik-tekrar-2.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-baslik-tekrar.mts --kutuk=$LOG_DIR/994831-baslik-tekrar-2-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-baslik-tekrar.mts --uygula --kutuk=$LOG_DIR/994831-baslik-tekrar-2-uygula.jsonl}"
exit 0
