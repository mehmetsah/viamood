#!/bin/bash
# ViaMood e-posta cron çağırıcısı: INTERNAL_API_KEY hiçbir zaman URL'de,
# crontab'da veya curl process argv'sinde taşınmaz.
set -eu
UYG_DIZIN="${UYG_DIZIN:-/var/www/viamood}"
ENV_DOSYA="$UYG_DIZIN/.env.production"
[ -f "$ENV_DOSYA" ] || { echo "ortam dosyası yok" >&2; exit 1; }
# shellcheck disable=SC1090
. "$ENV_DOSYA"
[ -n "${INTERNAL_API_KEY:-}" ] || { echo "cron yetki anahtarı tanımsız" >&2; exit 1; }
UC="${EPOSTA_AKIS_UC:-https://hesap.viamood.com.tr/api/cron/eposta-akis}"
SORGU='?limit=100'
if [ "${1:-}" = '--prova' ]; then SORGU='?prova=1&limit=5'; fi
# curl 7.55+: --header @- başlıkları stdin'den okur. Secret URL/argv'de YOK.
printf 'Authorization: Bearer %s\n' "$INTERNAL_API_KEY" | curl -fsS -m 30 --header @- "$UC$SORGU"
