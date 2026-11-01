#!/bin/bash
# #994831 · SSS YER TUTUCU DÜŞÜRME — 1 ürün (ultra-street-fighter-ii-m-bison-aksiyon-figuru): «Ürün kodu nedir?» → «Model kodu: 34XXX (kutudaki EAN'ı gir).» satırı GİZLENİR (acik=false, satır silinmez); öteki sorular/sıralar aynı; ÖNCESİ küme kütükte — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/sss-dusur.mts — şüphede ürünü ATLAR;
# kapı: yalnız kargo/iade ekseni ya da yer tutuculu cevap (src/lib/sss-yer-tutucu.ts) · soru açıkta tam bir kez ve cevap = öncesi · yalnız bu satır düşer · ÖNCESİ kütüğe yazılmadan yazma yok; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-yer-tutucu-dusur" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-yer-tutucu-dusur.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-yer-tutucu-dusur.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-dusur.mts veri/994831-sss-yer-tutucu-dusur.jsonl --kutuk=$LOG_DIR/994831-sss-yer-tutucu-dusur-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-dusur.mts veri/994831-sss-yer-tutucu-dusur.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-yer-tutucu-dusur-uygula.jsonl}"
exit 0
