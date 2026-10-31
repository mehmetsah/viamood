#!/bin/bash
# #994831 · JADA STITCH SSS BOYUT CEVABI — 4 ürün (SKU 505-508): «Boyutu nedir?» cevabındaki kaynaksız «6,35 cm (2.5")» ürünün güncel açıklamasındaki kaynaklı değere çekilir; soru, sıra ve öteki cevaplar aynı; ÖNCESİ SSS kütükte — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/sss-duzelt.mts — şüphede ürünü ATLAR;
# metin kapısı (yeni cevap güncel açıklamada anahtarıyla birebir) + eksen kapısı (sss-eksen.ts aynen) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "sss-jada-boyut" \
  "${DAMGA:-/var/www/viamood-extras/994831-sss-jada-boyut.damga}" \
  "${LOG:-$LOG_DIR/994831-sss-jada-boyut.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/sss-duzelt.mts veri/994831-sss-jada-boyut.jsonl --kutuk=$LOG_DIR/994831-sss-jada-boyut-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/sss-duzelt.mts veri/994831-sss-jada-boyut.jsonl --uygula --kutuk=$LOG_DIR/994831-sss-jada-boyut-uygula.jsonl}"
exit 0
