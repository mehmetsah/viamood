#!/bin/bash
# Server-side deploy — git pull + build + restart
# Çalıştırma (sunucuda): cd /var/www/viamood && bash scripts/deploy.sh
# Local'den: ./scripts/push.sh (otomatik tetikler)
set -e

cd /var/www/viamood

echo "════════════════════════════════════════════"
echo "  Via Mood — Production Deploy"
echo "  $(date +'%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════"

OLD_COMMIT=$(git rev-parse --short HEAD)
echo "  Eski: $OLD_COMMIT"

echo ""
echo "▸ Git pull..."
git fetch --quiet origin main
git reset --hard origin/main --quiet
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "  Yeni: $NEW_COMMIT"

# package.json değiştiyse npm ci
if [ "$OLD_COMMIT" != "$NEW_COMMIT" ] && git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" 2>/dev/null | grep -q "^package\(-lock\)\?\.json$"; then
  echo ""
  echo "▸ package.json değişti — npm ci..."
  npm ci --legacy-peer-deps --no-audit --no-fund
fi

# Yeni migration var mı
if [ "$OLD_COMMIT" != "$NEW_COMMIT" ] && git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" 2>/dev/null | grep -q "^drizzle/"; then
  echo ""
  echo "▸ Yeni migration — uygulanıyor..."
  set -a && source .env.production && set +a
  npx drizzle-kit migrate
fi

# Build
echo ""
echo "▸ Next.js build..."
set -a && source .env.production && set +a
NEXT_TELEMETRY_DISABLED=1 npm run build > /tmp/viamood-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "  ✗ BUILD FAİL"
  tail -20 /tmp/viamood-build.log
  exit 1
fi
echo "  ✓ Build OK"

# Standalone bundle'a static + public kopyala
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp .env.production .next/standalone/.env.production

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

echo ""
echo "════════════════════════════════════════════"
echo "  ✓ Deploy tamam: $OLD_COMMIT → $NEW_COMMIT"
echo "════════════════════════════════════════════"
