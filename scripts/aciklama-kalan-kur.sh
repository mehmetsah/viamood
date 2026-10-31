#!/bin/bash
# #994831 · KALAN İÇERİK HATALARI — 3 ürün (Wreckin Rock Jaw: asorti dili kaldırılır, kaynaklı metin yazılır · 2 ürün: sondaki yarım «Ürünün» düşer, yerine bir şey yazılmaz; ÖNCESİ HTML kütükte) — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-degistir.mts — şüphede ürünü ATLAR;
# metin kapısı (düz metin = bağımsız beklenti) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-kalan" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-kalan.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-kalan.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-kalan.jsonl --kutuk=$LOG_DIR/994831-aciklama-kalan-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-kalan.jsonl --uygula --kutuk=$LOG_DIR/994831-aciklama-kalan-uygula.jsonl}"
exit 0
