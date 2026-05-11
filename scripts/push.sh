#!/bin/bash
# Local deploy wrapper — push + remote deploy.
# Çalıştırma: ./deploy.sh
#
# Akış:
#   1. Local'de uncommitted değişiklik var mı uyarısı
#   2. git push origin main
#   3. ssh viamood "cd /var/www/viamood && bash scripts/deploy.sh"
set -e

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ Local'de commit edilmemiş değişiklik var:"
  git status --short
  echo ""
  read -p "Yine de devam? (y/N) " yn
  case "$yn" in
    [Yy]*) ;;
    *) echo "İptal."; exit 1 ;;
  esac
fi

echo "▸ Local push..."
git push origin main

echo ""
echo "▸ Sunucuda deploy başlatılıyor..."
ssh viamood "cd /var/www/viamood && bash scripts/deploy.sh"
