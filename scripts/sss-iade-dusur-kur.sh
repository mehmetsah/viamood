#!/bin/bash
# #994831 · SSS İADE SORUSU DÜŞÜRME — 2 ürün (tripot-model-3lu-saksi-seti · snackles-…-sally-fruit-tella): kural dışı «İade edebilir miyim?» satırı GİZLENİR (acik=false, satır silinmez); öteki sorular/sıralar aynı; ÖNCESİ küme kütükte — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/sss-dusur.mts — şüphede ürünü ATLAR;
# kapı: yalnız kargo/iade ekseni · soru açıkta tam bir kez ve cevap = öncesi · yalnız bu satır düşer · ÖNCESİ kütüğe yazılmadan yazma yok; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-iade-dusur" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-iade-dusur.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-iade-dusur.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-dusur.mts veri/994831-sss-iade-dusur.jsonl --kutuk=$LOG_DIR/994831-sss-iade-dusur-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-dusur.mts veri/994831-sss-iade-dusur.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-iade-dusur-uygula.jsonl}"
exit 0
