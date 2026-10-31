#!/bin/bash
# DAMGALI TEK SEFERLİK KOŞU — deploy.sh kancalarının ortak gövdesi (#994831 / #994995).
#
# Sıra (her adım log'a yazılır):
#   0) DAMGA dosyası VARSA hiçbir şey yapılmaz (iş bir kez yapıldı; tekrar koşmak yasak).
#   1) KURU koşu (yazmasız). Çıkış kodu ≠ 0 ⇒ UYGULA'ya GEÇİLMEZ, damga yazılmaz.
#   2) UYGULA koşusu. Çıkış kodu ≠ 0 ⇒ damga yazılmaz (bir sonraki deploy yeniden dener;
#      betiklerin kendi idempotans kapıları — "zaten-yazili" / md5 ÖNCESİ — ikinci yazımı engeller).
#   3) Başarılıysa DAMGA yazılır.
# Best-effort: bu betik deploy'u ASLA düşürmez — her durumda 0 ile çıkar.
#
# Kullanım: damgali_kos <ad> <damga-yolu> <log-yolu> <kuru-komut> <uygula-komut>
damgali_kos() {
  local ad="$1" damga="$2" log="$3" kuru="$4" uygula="$5"
  mkdir -p "$(dirname "$log")" 2>/dev/null
  _yaz() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $ad: $*" >> "$log"; }
  if [ -e "$damga" ]; then _yaz "damga var ($damga) — dokunulmadı"; return 0; fi
  _yaz "KURU koşu başlıyor"
  if ! bash -c "$kuru" >> "$log" 2>&1; then _yaz "KURU koşu hatalı ⇒ UYGULA YAPILMADI, damga yok"; return 0; fi
  _yaz "KURU koşu temiz ⇒ UYGULA başlıyor"
  if ! bash -c "$uygula" >> "$log" 2>&1; then _yaz "UYGULA hatalı ⇒ damga YAZILMADI (sonraki deploy yeniden dener)"; return 0; fi
  mkdir -p "$(dirname "$damga")" 2>/dev/null
  if date '+%Y-%m-%d %H:%M:%S' > "$damga" 2>/dev/null; then _yaz "TAMAM — damga yazıldı ($damga)"; else _yaz "UYGULA tamam ama damga YAZILAMADI ($damga)"; fi
  return 0
}
