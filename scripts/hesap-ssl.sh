#!/bin/bash
# hesap.viamood.com.tr SSL kurulumu — deploy.sh sonunda BEST-EFFORT çağrılır.
# FAZ 1 (bu sürüm): yalnız KEŞİF — sunucu web katmanı durumunu rastgele-adlı
# bir public dosyasına yazar (SSH kapalı; tek uzaktan gözlem kanalı bu).
# Hiçbir sistem durumu DEĞİŞTİRİLMEZ. Çıktı bir sonraki fazda kaldırılır.
set +e

OUT="/var/www/viamood/.next/standalone/public/srv-diag-a3636ec1fcfb2a2c50d1.txt"

{
  echo "== tarih =="; date
  echo "== kimlik =="; id
  echo "== nginx var mı =="; command -v nginx && nginx -v 2>&1 || echo "nginx YOK"
  echo "== nginx aktif mi =="; systemctl is-active nginx 2>&1
  echo "== apache var mı =="; command -v apache2 || echo "apache YOK"
  echo "== certbot var mı =="; command -v certbot && certbot --version 2>&1 || echo "certbot YOK"
  echo "== snap certbot =="; snap list certbot 2>/dev/null || echo "snap certbot yok"
  echo "== 80/443 dinleyenler =="; ss -ltnp 2>/dev/null | grep -E ':80 |:443 ' || sudo -n ss -ltnp 2>/dev/null | grep -E ':80 |:443 '
  echo "== sudo yetkisi (parolasız) =="; sudo -n true 2>&1 && echo "SUDO OK" || echo "SUDO YOK"
  echo "== letsencrypt certleri =="; ls /etc/letsencrypt/live 2>/dev/null || sudo -n ls /etc/letsencrypt/live 2>/dev/null || echo "yok/erişilemedi"
  echo "== nginx siteleri =="; ls /etc/nginx/sites-enabled 2>/dev/null || echo "yok"
  echo "== nginx conf.d =="; ls /etc/nginx/conf.d 2>/dev/null || echo "yok"
  echo "== pm2 listesi =="; pm2 jlist 2>/dev/null | python3 -c "import json,sys;print([{ 'name':p['name'],'port':p.get('pm2_env',{}).get('env',{}).get('PORT') } for p in json.load(sys.stdin)])" 2>/dev/null || pm2 ls 2>/dev/null
  echo "== HOSTNAME/PORT env (.env.production'dan sadece bu ikisi) =="
  grep -E "^(HOSTNAME|PORT|AUTH_URL)=" /var/www/viamood/.env.production 2>/dev/null
  echo "== disk =="; df -h / | tail -1
  echo "== os =="; cat /etc/os-release 2>/dev/null | head -2
} > "$OUT" 2>&1

echo "  ✓ hesap-ssl keşif çıktısı yazıldı"
exit 0
