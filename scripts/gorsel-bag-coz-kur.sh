#!/bin/bash
# #995648 · İKİ «© Disney YETKİLİ SATICI» GÖRSELİNİN ÜRÜN BAĞI ÇÖZÜLÜR — Jada Stitch Hula + Ukulele: görsel ürün galerisinden kalkar, DOSYA SİLİNMEZ (Shopify Files'ta kalır, fileUpdate referencesToRemove); kalan galeri sırası ve ana görsel aynı; ÖNCESİ galeri sırası kütükte — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/gorsel-bag-coz.mts — şüphede ürünü ATLAR; bağ çözüldükten sonra dosya Files'ta görünmüyorsa İŞ DURUR.
# kapı: ürün kimliği · galeri sırası = öncesi · hedef medya tam bir kez + dosya adı · ana görsel değil · ÖNCESİ kütüğe yazılmadan yazma yok; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "gorsel-bag-coz" \
  "${DAMGA:-/var/www/viamood-extras/995648-gorsel-bag-coz.damga}" \
  "${LOG:-$LOG_DIR/995648-gorsel-bag-coz.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/gorsel-bag-coz.mts veri/995648-gorsel-bag-coz.jsonl --kutuk=$LOG_DIR/995648-gorsel-bag-coz-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/gorsel-bag-coz.mts veri/995648-gorsel-bag-coz.jsonl --uygula --kutuk=$LOG_DIR/995648-gorsel-bag-coz-uygula.jsonl}"
exit 0
