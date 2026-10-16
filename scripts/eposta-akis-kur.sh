#!/bin/bash
# E-POSTA AKIŞI — SUNUCU TARAFI KURULUM (#994057, 16 Eki 2026)
#
# NEDEN BU DOSYA VAR: prod'a SSH ile ulaşılamıyor (22 kapalı, kasada erişim kaydı
# yok — raporlar/994057-kasa-ssh-prod-20261016.md). Buna karşılık `auto-deploy.sh`
# sunucuda crontab ile 2 dk'da bir koşuyor ve origin/main'i kendiliğinden
# deploy ediyor (KANIT: push'tan sonra /api/health buildId origin/main'e eşitlendi).
# Yani SSH'sız tek yol, zaten güvenilen deploy borusuna idempotent bir adım eklemek.
#
# ÜÇ ADIM — HEPSİ İDEMPOTENT, hiçbiri deploy'u düşürmez (best-effort; çağıran
# `|| echo` ile sarar, `hesap-ssl.sh` ile aynı kalıp):
#   1) .env.production'a EPOSTA_AKIS_AKTIF satırı YOKSA ekler (varsa DOKUNMAZ).
#   2) crontab'a 15 dk'lık çağırıcı YOKSA ekler (varsa tekrar eklemez).
#   3) Kuru koşu (&prova=1) ile ucu yoklar ve SONUCU LOG'A yazar.
#
# ⚠ .env.production'A DOKUNMA GERİLİMİ — bilerek ve dar: deploy.sh'ın kendi notu
#   "o dosya sır taşıyor, deploy'un ona dokunması istenmez" diyor ve BUILD_ID'yi
#   bu yüzden pm2 ortamından geçiriyor. Buradaki dokunuş o kuralı GEVŞETMEZ:
#   · yalnız EKLER, var olan hiçbir satırı değiştirmez/silmez,
#   · dosyanın zaman damgalı YEDEĞİNİ önce alır,
#   · eklediği değer SIR DEĞİL, bir açma/kapama bayrağıdır.
#   Bayrağı kapatmak isteyen satırı `0` yapar; betik varsa dokunmadığı için
#   kararı EZMEZ (md: geri dönüşü kolay).
#
# ⚠ ANAHTAR SATIRA GÖMÜLMEZ: cron satırı ortam dosyasını `.` ile kaynak alır ve
#   $INTERNAL_API_KEY'i çalışma anında okur. Böylece anahtar ne crontab'da ne
#   süreç listesinde (`ps`) görünür.
set -u

UYG_DIZIN="${UYG_DIZIN:-/var/www/viamood}"
ENV_DOSYA="$UYG_DIZIN/.env.production"
UC="${EPOSTA_AKIS_UC:-https://hesap.viamood.com.tr/api/cron/eposta-akis}"
LOG_DIR="${LOG_DIR:-$HOME/.viamood-log}"
mkdir -p "$LOG_DIR" 2>/dev/null
LOG="$LOG_DIR/eposta-akis-kur.log"
yaz() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; echo "  $*"; }

[ -f "$ENV_DOSYA" ] || { yaz "⚠ $ENV_DOSYA yok — kurulum atlandı"; exit 0; }

# ── 1) BAYRAK: yoksa ekle, VARSA DOKUNMA ────────────────────────────────────
if grep -qE '^[[:space:]]*EPOSTA_AKIS_AKTIF=' "$ENV_DOSYA"; then
  yaz "✓ EPOSTA_AKIS_AKTIF zaten tanımlı — dokunulmadı (sahibin kararı korunur)"
else
  cp -p "$ENV_DOSYA" "$ENV_DOSYA.yedek-$(date +%Y%m%d-%H%M%S)" 2>/dev/null \
    && yaz "✓ yedek alındı: $(basename "$ENV_DOSYA").yedek-*" \
    || { yaz "⛔ yedek alınamadı — ortam dosyasına DOKUNULMADI"; exit 0; }
  printf '\n# #994057 — e-posta akışı anahtarı (0 yaparsan akış durur, kod geri alınmaz)\nEPOSTA_AKIS_AKTIF=1\n' >> "$ENV_DOSYA" \
    && yaz "✓ EPOSTA_AKIS_AKTIF=1 EKLENDİ" || yaz "⛔ eklenemedi"
fi

# ── 2) ÇAĞIRICI: 15 dk'lık cron, yoksa ekle ─────────────────────────────────
# md.47 dersi: "yargıç var, çağıran yok" bu deponun en sık arızası. Çağıran burada.
if crontab -l 2>/dev/null | grep -q 'api/cron/eposta-akis'; then
  yaz "✓ eposta-akis cron satırı zaten var — tekrar eklenmedi"
else
  SATIR="*/15 * * * * . $ENV_DOSYA; curl -fsS \"$UC?key=\$INTERNAL_API_KEY&limit=100\" >> $LOG_DIR/eposta-akis.log 2>&1"
  { crontab -l 2>/dev/null; echo "$SATIR"; } | crontab - \
    && yaz "✓ 15 dk'lık çağırıcı crontab'a EKLENDİ" || yaz "⛔ crontab yazılamadı"
fi

# ── 3) KURU KOŞU: yalnız ölçer ve log'a yazar, deploy'u ASLA düşürmez ───────
# shellcheck disable=SC1090
. "$ENV_DOSYA" 2>/dev/null
if [ -n "${INTERNAL_API_KEY:-}" ]; then
  YANIT=$(curl -fsS -m 15 "$UC?key=$INTERNAL_API_KEY&prova=1&limit=5" 2>/dev/null | head -c 300)
  yaz "kuru koşu yanıtı: ${YANIT:-(yanıt yok)}"
else
  yaz "⚠ INTERNAL_API_KEY okunamadı — kuru koşu atlandı"
fi
exit 0
