#!/bin/bash
# #994831 · AÇIKLAMA DALGA 10 — ZAYIF AÇIKLAMAYA ÜRÜNÜN KENDİ VERİSİNDEN «Teknik Bilgiler» TABLOSU (65 ürün; mevcut metin korunur, ek sona)
# — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Girdi: veri/994831-aciklama-dalga10.jsonl (5 Kas 2026; kaynak anlık görüntüsü veri/994831-aciklama-dalga10-kaynak.jsonl).
# Kaynak kapısı: src/lib/aciklama-zengin.ts (çivi tests/aciklama-zengin.test.ts). Yazma: scripts/aciklama-ekle.mts —
# canlı açıklama öncesiyle bayt bayt aynı değilse ATLAR, yazmadan önce yeniden okur, aciklamaYazKapisi'ndan geçer, ÖNCESİ kütüğe yazılır.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-dalga10" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-dalga10.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-dalga10.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-ekle.mts veri/994831-aciklama-dalga10.jsonl --kutuk=$LOG_DIR/994831-aciklama-dalga10-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-ekle.mts veri/994831-aciklama-dalga10.jsonl --uygula --kutuk=$LOG_DIR/994831-aciklama-dalga10-uygula.jsonl}"
exit 0
