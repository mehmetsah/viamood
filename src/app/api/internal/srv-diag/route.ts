/**
 * GET /api/internal/srv-diag?key=<SHOPIFY_CLIENT_SECRET>
 *
 * Sunucu web katmanı teşhisi (SSH kapalı — hesap.viamood.com.tr SSL kurulumu
 * için gereken bilgiler): nginx/certbot/port/sudo durumu. SADECE sabit,
 * read-only komutlar çalıştırır; parametreyle komut ALINMAZ (RCE yüzeyi yok).
 * Yetki: auto-fulfill ile aynı desen (key = SHOPIFY_CLIENT_SECRET, sabit-zaman).
 * SSL kurulumu bitince bu route kaldırılabilir.
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function keyOk(key: string | null): boolean {
  const secret = env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const KOMUTLAR: Array<[string, string]> = [
  ['kimlik', 'id'],
  ['nginx', 'command -v nginx && nginx -v 2>&1 || echo YOK'],
  ['nginx_aktif', 'systemctl is-active nginx 2>&1 || echo -'],
  ['certbot', 'command -v certbot && certbot --version 2>&1 || echo YOK'],
  ['snap_certbot', 'snap list certbot 2>/dev/null || echo yok'],
  ['portlar', "ss -ltnp 2>/dev/null | grep -E ':80 |:443 ' || echo okunamadi"],
  ['sudo_parolasiz', 'sudo -n true 2>&1 && echo SUDO_OK || echo SUDO_YOK'],
  ['le_certler', 'ls /etc/letsencrypt/live 2>/dev/null || sudo -n ls /etc/letsencrypt/live 2>/dev/null || echo yok'],
  ['nginx_siteler', 'ls /etc/nginx/sites-enabled 2>/dev/null; ls /etc/nginx/conf.d 2>/dev/null'],
  ['pm2', 'pm2 ls 2>/dev/null | head -8 || echo yok'],
  ['env_host', "grep -E '^(HOSTNAME|PORT|AUTH_URL)=' /var/www/viamood/.env.production 2>/dev/null || echo okunamadi"],
  ['disk', 'df -h / | tail -1'],
  ['os', 'head -2 /etc/os-release 2>/dev/null'],
  ['apt_kilit', 'command -v apt-get >/dev/null && echo apt_var || echo apt_yok'],
];

export async function GET(req: NextRequest) {
  if (!keyOk(req.nextUrl.searchParams.get('key'))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const sonuc: Record<string, string> = {};
  for (const [ad, cmd] of KOMUTLAR) {
    try {
      sonuc[ad] = execSync(cmd, { timeout: 8000, encoding: 'utf8', shell: '/bin/bash' })
        .trim()
        .slice(0, 2000);
    } catch (e) {
      sonuc[ad] = `HATA: ${e instanceof Error ? e.message.slice(0, 300) : 'bilinmiyor'}`;
    }
  }

  return NextResponse.json({ ok: true, sonuc });
}
