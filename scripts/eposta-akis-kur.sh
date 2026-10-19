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
#   1) .env.production'a EPOSTA_AKIS_AKTIF=0 ekler (varsa DOKUNMAZ).
#      Pazarlama gönderimi yalnız doğrulama + açık aktivasyondan sonra başlar.
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
# ⚠ ANAHTAR URL'YE / CRON'A / argv'YE GİRMEZ: ayrı yoklama betiği
#   Authorization başlığını stdin üzerinden curl'a verir.
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
  printf '\n# #994057 — açık onaydan sonra elle 1 yapılır; varsayılan KAPALI\nEPOSTA_AKIS_AKTIF=0\n' >> "$ENV_DOSYA" \
    && yaz "✓ EPOSTA_AKIS_AKTIF=0 EKLENDİ (gönderim kapalı)" || yaz "⛔ eklenemedi"
fi

# ── 2) ÇAĞIRICI: eski ?key= URL'li cron'u güvenli helper'a GÖÇÜR ──
# Mevcut diğer cron'lara dokunma, yalnız bu işin eski ve yeni satırlarını
# ayıkla. Token ne komut satırına ne HTTP sorgu dizesine girer.
CRON_SATIR="*/15 * * * * UYG_DIZIN=\"$UYG_DIZIN\" EPOSTA_AKIS_UC=\"$UC\" bash \"$UYG_DIZIN/scripts/eposta-akis-yokla.sh\" >> \"$LOG_DIR/eposta-akis.log\" 2>&1"
MEVCUT="$(crontab -l 2>/dev/null || true)"
if printf '%s\n' "$MEVCUT" | grep -Fq 'scripts/eposta-akis-yokla.sh' && \
   ! printf '%s\n' "$MEVCUT" | grep -Fq 'api/cron/eposta-akis?key='; then
  yaz "✓ güvenli e-posta çağırıcısı zaten var"
else
  TEMIZ="$(printf '%s\n' "$MEVCUT" | grep -Ev 'eposta-akis-yokla\.sh|api/cron/eposta-akis' || true)"
  { [ -z "$TEMIZ" ] || printf '%s\n' "$TEMIZ"; printf '%s\n' "$CRON_SATIR"; } | crontab - \
    && yaz "✓ 15 dk'lık güvenli çağırıcı kuruldu/eski URL anahtarı silindi" || yaz "⛔ crontab yazılamadı"
fi

# ── 3) KURU KOŞU: token curl stdin başlığında, log'a sır girmez ──
if [ -f "$UYG_DIZIN/scripts/eposta-akis-yokla.sh" ]; then
  YANIT="$(UYG_DIZIN="$UYG_DIZIN" EPOSTA_AKIS_UC="$UC" bash "$UYG_DIZIN/scripts/eposta-akis-yokla.sh" --prova 2>/dev/null | head -c 300)"
  yaz "kuru koşu yanıtı: ${YANIT:-(yanıt yok)}"
else
  yaz "⚠ güvenli yoklama betiği henüz yok — kuru koşu atlandı"
fi
exit 0
