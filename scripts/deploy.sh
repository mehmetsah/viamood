#!/bin/bash
# Server-side deploy — git pull + build + restart
# Çalıştırma (sunucuda): cd /var/www/viamood && bash scripts/deploy.sh
# Local'den: ./scripts/push.sh (otomatik tetikler)
set -e

cd /var/www/viamood

# ──────────────────────────────────────────────────────────────────────────
# Ortak deploy kilidi — cron auto-deploy.sh ile ÇAKIŞMAYI önler.
# 1.9GB instance'ta iki eşzamanlı Next.js build OOM yapar → sshd boğulur, build yarıda kalır.
# auto-deploy.sh kilidi ZATEN tutuyorsa (DEPLOY_LOCK_HELD=1 geçirir) tekrar alma → deadlock yok.
# Manuel `bash scripts/deploy.sh`'ta ise kilidi al → cron build'iyle çakışmayı engelle.
# FD 9 re-exec'e miras kalır (lock korunur); flock yalnız ilk (re-exec öncesi) çağrıda alınır.
# ──────────────────────────────────────────────────────────────────────────
if [ -z "$DEPLOY_LOCK_HELD" ] && [ -z "$DEPLOY_REEXEC" ]; then
  exec 9>/tmp/viamood-autodeploy.lock
  if ! flock -w 600 9; then echo "⚠ Başka bir deploy (cron) sürüyor — atlandı."; exit 1; fi
fi

# ──────────────────────────────────────────────────────────────────────────
# Self-update guard: deploy.sh kendini güncelliyor (git reset diskteki betiği değiştirir).
# Bash betiği byte-offset ile okuduğundan, pull sonrası ESKİ sürüm çalışmaya devam eder →
# yeni adımlar (migration vs.) atlanır. Çözüm: İLK çağrıda SADECE pull + YENİ deploy.sh re-exec.
# ──────────────────────────────────────────────────────────────────────────
if [ -z "$DEPLOY_REEXEC" ]; then
  OLD_COMMIT=$(git rev-parse --short HEAD)
  echo "▸ Git pull..."
  git fetch --quiet origin main
  git reset --hard origin/main --quiet
  exec env DEPLOY_REEXEC=1 DEPLOY_OLD_COMMIT="$OLD_COMMIT" bash scripts/deploy.sh
fi

# ── Buradan itibaren YENİ deploy.sh çalışıyor (re-exec sonrası) ──
OLD_COMMIT="${DEPLOY_OLD_COMMIT:-$(git rev-parse --short HEAD)}"
NEW_COMMIT=$(git rev-parse --short HEAD)

echo "════════════════════════════════════════════"
echo "  Via Mood — Production Deploy"
echo "  $(date +'%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════"
echo "  $OLD_COMMIT → $NEW_COMMIT"

# package.json değiştiyse npm ci
if [ "$OLD_COMMIT" != "$NEW_COMMIT" ] && git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" 2>/dev/null | grep -q "^package\(-lock\)\?\.json$"; then
  echo ""
  echo "▸ package.json değişti — npm ci..."
  npm ci --legacy-peer-deps --no-audit --no-fund
fi

# Env (migration + build için)
set -a && source .env.production && set +a

# Journaled migration'lar (drizzle-kit migrate — meta/_journal.json'daki 0000-0005)
echo ""
echo "▸ Drizzle migrate (journaled)..."
npx drizzle-kit migrate || echo "  (drizzle-kit migrate uyarı/no-op)"

# Elle yazılan idempotent migration'lar (journal'da YOK — db:generate kırıktı, ekip elle yazıyor).
# HER deploy'da güvenle tekrar uygulanır (IF NOT EXISTS / DO-EXCEPTION guard). Build'den ÖNCE →
# yeni kod eksik kolona/tabloya düşmez. Yeni elle migration eklenince listeye ekle.
echo ""
echo "▸ Elle migration'lar (idempotent)..."
for m in 0008_customers 0009_native_orders 0010_carts 0011_store_settings 0011_ads 0012_settings_backend_theme 0013_returns 0014_reviews 0015_goknil_admin 0016_goknil_pwreset 0017_goknil_upsert 0018_tenants 0019_kargolab_vendor_member 0020_kargolab_enabled 0024_password_reset 0023_auth_social 0022_welcome_signups 0025_payment_refunds 0026_veri_silme; do
  if [ -f "drizzle/$m.sql" ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "drizzle/$m.sql" && echo "  ✓ $m" || { echo "  ✗ $m FAİL"; exit 1; }
  fi
done

# Build
echo ""
echo "▸ Next.js build..."
# ÖLÇÜLMÜŞ ARIZA (25 Eyl 2026): build TS hatasıyla düştü, burada `exit 1` verildi ve
# YARIM KALAN .next öylece bırakıldı. Next build çıktı ağacını önce siler; çalışan pm2
# süreci silinmiş inode'da asılı kaldı (cwd=…/.next/standalone (deleted)) ve tüm istekler
# 502 almaya başladı. Kapı vardı, GERİ DÖNÜŞ yoktu.
#
# Yedek yöntemi `cp -al` (hardlink): 68 MB'lık ağacı saniyeler yerine anlık kopyalar ve
# disk yemez — dosya içerikleri paylaşılır, yalnız dizin girdileri çoğalır. Next build
# dosyaları SİLİP yeniden yazdığı için (üzerine yazmaz) hardlink'ler bozulmaz.
# `mv` seçilmedi: build sırasında .next yolu tümden kaybolur ve çalışan süreç lazy chunk
# okuyamaz. Hardlink'te orijinal yol build bitene kadar yerinde kalır.
YEDEK=".next.onceki-$(date +%H%M%S)"
if [ -d .next ]; then
  cp -al .next "$YEDEK" 2>/dev/null || cp -r .next "$YEDEK"
fi
if ! NEXT_TELEMETRY_DISABLED=1 npm run build > /tmp/viamood-build.log 2>&1; then
  echo "  ✗ BUILD FAİL — eski .next geri konuyor"
  tail -20 /tmp/viamood-build.log
  if [ -d "$YEDEK" ]; then
    rm -rf .next && mv "$YEDEK" .next
    # Süreç yarım ağaçta asılı kalmasın diye sağlam .next ile yeniden bağlanır.
    pm2 restart viamood-web --update-env > /dev/null 2>&1
    sleep 3
    echo "  ↩ eski .next geri kondu · BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || echo YOK) · health=$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://localhost/api/health)"
  else
    echo "  ⚠ geri konacak yedek YOK — .next hiç yoktu"
  fi
  exit 1
fi
rm -rf "$YEDEK"          # başarılı build: yedek birikmesin
echo "  ✓ Build OK"

# Standalone bundle'a static + public kopyala
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp .env.production .next/standalone/.env.production

# Gitignored credentials HTML'i (access-*.html) korumak için
# /var/www/viamood-extras/ persistent klasöründen kopyala
if [ -d /var/www/viamood-extras ]; then
  for f in /var/www/viamood-extras/access-*.html; do
    [ -f "$f" ] && cp "$f" public/ && cp "$f" .next/standalone/public/ && echo "  ✓ Restored: $(basename $f)"
  done
fi

echo ""
echo "▸ PM2 restart..."
pm2 restart viamood-web --update-env > /dev/null
sleep 2

STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health)
if [ "$STATUS" = "200" ]; then
  echo "  ✓ Health: $STATUS"
else
  echo "  ✗ Health: $STATUS"
  pm2 logs viamood-web --lines 10 --nostream
  exit 1
fi

# hesap.viamood.com.tr SSL kurulumu (idempotent, best-effort — deploy'u asla bozmaz)
bash scripts/hesap-ssl.sh || echo "  (hesap-ssl adımı atlandı)"

echo ""
echo "════════════════════════════════════════════"
echo "  ✓ Deploy tamam: $OLD_COMMIT → $NEW_COMMIT"
echo "════════════════════════════════════════════"
