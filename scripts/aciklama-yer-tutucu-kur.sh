#!/bin/bash
# #994831 · AÇIKLAMADAKİ YER TUTUCULAR — 4 ürün: m-bison «Model kodu · 34XXX (kutudaki EAN'ı gir)» tablo satırı · 3 Hot Wheels F1 2025 2'li «Güvenlik Uyarısı / ___ (kutudaki yaş bilgisine göre doldur)» başlık + paragraf DÜŞER (kaynak yok, uydurma değer yazılmaz — md.52); açıklamanın geri kalanı bayt bayt aynı; başlık/handle/barkod değişmez; ÖNCESİ HTML yazmadan ÖNCE kütükte — deploy.sh kancası (damgalı, tek seferlik, best-effort).
# Betik: scripts/aciklama-degistir.mts (yer tutucu kipi) — şüphede ürünü ATLAR;
# metin kapısı (yeni HTML = değişimlerin öncesine birebir uygulanmış hâli) + bütün blok + yer tutucu kapısı (sonrasında 0) geçmezse YAZMAZ; yazmadan önce yeniden okur.
# Ortam değişkenleriyle test edilebilir: DAMGA · LOG · KURU_KOMUT · UYGULA_KOMUT.
cd "$(dirname "$0")/.." || exit 0
. scripts/_damgali-kur.sh
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
ORTAM='set -a; [ -f ./.env.production ] && . ./.env.production; set +a;'
damgali_kos "aciklama-yer-tutucu" \
  "${DAMGA:-/var/www/viamood-extras/994831-aciklama-yer-tutucu.damga}" \
  "${LOG:-$LOG_DIR/994831-aciklama-yer-tutucu.log}" \
  "${KURU_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-yer-tutucu.jsonl --kutuk=$LOG_DIR/994831-aciklama-yer-tutucu-kuru.jsonl}" \
  "${UYGULA_KOMUT:-$ORTAM npx tsx scripts/aciklama-degistir.mts veri/994831-aciklama-yer-tutucu.jsonl --uygula --kutuk=$LOG_DIR/994831-aciklama-yer-tutucu-uygula.jsonl}"
exit 0
