#!/bin/bash
# #994831 · JADA STITCH ÖLÇÜ METNİ — 4 ürün (SKU 505-508): kaynaksız ölçüler (6,35 cm · 6,35 × 2,6 × 3,5 cm · Surfing 6,5 cm) düşer, ürünün kendi görselindeki ölçü yazılır; başlık/handle/barkod değişmez; ÖNCESİ HTML kütükte — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-degistir.mts — şüphede ürünü ATLAR;
# metin kapısı (yeni HTML = değişimlerin öncesine birebir uygulanmış hâli) + kaynak kapısı (yazılan her sayı ürün görselindeki ölçüde) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-jada-olcu" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-jada-olcu.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-jada-olcu.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-jada-olcu.jsonl --kutuk=$LOG_DIR/994831-aciklama-jada-olcu-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-jada-olcu.jsonl --uygula --kutuk=$LOG_DIR/994831-aciklama-jada-olcu-uygula.jsonl}"
exit 0
