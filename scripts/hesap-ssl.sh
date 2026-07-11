#!/bin/bash
# hesap.viamood.com.tr SSL — FAZ 2: nginx vhost + Let's Encrypt (idempotent).
# deploy.sh sonunda BEST-EFFORT çağrılır; hata durumunda deploy'u bozmaz (exit 0).
# Keşif (srv-diag) bulguları: nginx 1.24 aktif, certbot 2.9, parolasız sudo, cert yok.
set +e

DOMAIN=hesap.viamood.com.tr
CERT_MAIL=developer@kargolab.com
LOG=/var/www/viamood/ssl-kurulum.log
TRIES=/var/www/viamood/.ssl-deneme

exec >>"$LOG" 2>&1
echo ""
echo "=== $(date '+%Y-%m-%d %H:%M:%S') hesap-ssl (FAZ 2) ==="

# 0) Zaten kurulu mu? (idempotent çıkış)
if sudo -n test -d "/etc/letsencrypt/live/$DOMAIN"; then
  echo "✓ Sertifika zaten var — no-op"
  exit 0
fi

# 0b) Let's Encrypt rate-limit koruması: en fazla 3 başarısız deneme,
#     sonra durur (manuel reset: bu dosyayı sil)
N=$(cat "$TRIES" 2>/dev/null || echo 0)
if [ "$N" -ge 3 ]; then
  echo "✗ 3 deneme doldu — durduruldu (reset için $TRIES silinmeli)"
  exit 0
fi
echo $((N + 1)) > "$TRIES"

# 1) vhost yoksa: mevcut çalışan siteyi şablon alarak oluştur
#    (proxy ayarları birebir korunur; default_server bayrağı temizlenir)
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
  SRC=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | head -1)
  if [ -z "$SRC" ]; then
    echo "✗ Şablon alınacak nginx sitesi yok — çık"
    exit 0
  fi
  echo "▸ Şablon: $SRC → $DOMAIN vhost'u oluşturuluyor"
  sudo -n sed -e "s/server_name .*;/server_name $DOMAIN;/" \
              -e "s/ default_server//g" \
              "/etc/nginx/sites-enabled/$SRC" \
    | sudo -n tee "/etc/nginx/sites-available/$DOMAIN" > /dev/null
  sudo -n ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

  if sudo -n nginx -t; then
    sudo -n systemctl reload nginx
    echo "✓ vhost aktif"
  else
    echo "✗ nginx -t BAŞARISIZ — vhost geri alınıyor (canlı config korunur)"
    sudo -n rm -f "/etc/nginx/sites-enabled/$DOMAIN"
    exit 0
  fi
fi

# 2) Sertifika + 443 bloğu + http→https yönlendirmesi (certbot nginx plugin)
echo "▸ certbot çalışıyor..."
sudo -n certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERT_MAIL" --redirect

if sudo -n test -d "/etc/letsencrypt/live/$DOMAIN"; then
  echo "✓ SERTİFİKA ALINDI — https://$DOMAIN aktif"
  rm -f "$TRIES"
  sudo -n nginx -t && sudo -n systemctl reload nginx
else
  echo "✗ Sertifika alınamadı (deneme $((N + 1))/3) — log yukarıda"
fi

exit 0
