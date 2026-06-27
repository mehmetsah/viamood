#!/bin/bash
# Otomatik deploy — origin/main değiştiyse deploy.sh'ı çalıştırır.
# Kurulum (sunucuda bir kez): crontab'a ekle → her 2 dk'da kontrol:
#   (crontab -l 2>/dev/null | grep -v auto-deploy; echo '*/2 * * * * bash /var/www/viamood/scripts/auto-deploy.sh') | crontab -
# Böylece "git push" sonrası sunucu kendi kendine güncellenir; laptop'tan SSH gerekmez.

exec 9>/tmp/viamood-autodeploy.lock
flock -n 9 || exit 0   # önceki çalışma sürüyorsa atla (üst üste deploy yok)

cd /var/www/viamood || exit 1
LOG=/tmp/viamood-autodeploy.log

git fetch --quiet origin main 2>/dev/null || exit 0
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] yeni sürüm $REMOTE — deploy başlıyor" >> "$LOG"
  bash scripts/deploy.sh >> "$LOG" 2>&1
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy bitti" >> "$LOG"
fi
