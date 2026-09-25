/**
 * Deploy sağlık kapısı ÇİVİSİ — kapı sessizce geçmesin.
 *
 * ÖLÇÜLMÜŞ ARIZA (25 Eyl 2026, prod):
 *   http://localhost/api/health             → 404   (nginx varsayılan sunucusu)
 *   https://hesap.viamood.com.tr/api/health → 200   (uç ÇALIŞIYOR)
 * deploy.sh 404 görüp `exit 1` veriyordu; auto-deploy.sh çıkış kodunu okumadığı için
 * log'a "deploy bitti" yazıyordu. Yani kapı vardı, HİÇ ÇALIŞMIYORDU.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const DEPLOY = readFileSync(path.join(KOK, 'scripts/deploy.sh'), 'utf8');
const AUTO = readFileSync(path.join(KOK, 'scripts/auto-deploy.sh'), 'utf8');

describe('deploy sağlık kapısı', () => {
  it('kapı localhost:80 yerine DOĞRUDAN uygulama portuna soruyor', () => {
    expect(DEPLOY, 'eski hedef geri gelmiş').not.toMatch(
      /curl[^\n]*-w "%\{http_code\}" http:\/\/localhost\/api\/health/,
    );
    expect(DEPLOY).toContain('SAGLIK_URL="http://127.0.0.1:${SAGLIK_PORT}/api/health"');
  });

  it('200 dışında her kod deploy\'u DÜŞÜRÜR (exit 1)', () => {
    const i = DEPLOY.indexOf('STATUS=$(curl');
    expect(i).toBeGreaterThan(-1);
    const blok = DEPLOY.slice(i, i + 600);
    expect(blok).toMatch(/if \[ "\$STATUS" = "200" \]/);
    expect(blok, 'başarısız dalda exit 1 yok').toMatch(/else[\s\S]*exit 1/);
  });

  it('NEGATİF: uç 200 dönmezse betik gerçekten 1 ile çıkar', () => {
    // Kapı bloğu izole çalıştırılır; curl sahte bir 503 döndürür.
    const i = DEPLOY.indexOf('STATUS=$(curl');
    const blok = DEPLOY.slice(i, DEPLOY.indexOf('\nfi', i) + 3);
    const betik = `
      SAGLIK_PORT=1; SAGLIK_URL=x
      curl() { echo "503"; }
      pm2() { :; }
      ${blok.replace(/STATUS=\$\(curl[^)]*\)/, 'STATUS=$(curl)')}
      echo "BURAYA GELMEMELI"
    `;
    let rc = 0;
    try {
      execFileSync('bash', ['-c', betik], { stdio: 'pipe' });
    } catch (e: unknown) {
      rc = (e as { status?: number }).status ?? 0;
    }
    expect(rc, 'sağlık kapısı 503 gördüğü hâlde çıkış 1 vermedi').toBe(1);
  });

  it('auto-deploy deploy.sh çıkış kodunu YUTMUYOR', () => {
    expect(AUTO, 'çıkış kodu okunmadan "deploy bitti" yazılıyor').not.toMatch(
      /bash scripts\/deploy\.sh >> "\$LOG" 2>&1\n\s*echo[^\n]*deploy bitti/,
    );
    expect(AUTO).toMatch(/if DEPLOY_LOCK_HELD=1 bash scripts\/deploy\.sh/);
    expect(AUTO).toMatch(/deploy BAŞARISIZ \(çıkış \$RC\)/);
  });

  it('sağlık ucu sır sızdırmıyor (token/secret/key basmıyor)', () => {
    const uc = readFileSync(path.join(KOK, 'src/app/api/health/route.ts'), 'utf8');
    expect(uc).not.toMatch(/SECRET|TOKEN|PASSWORD|API_KEY|process\.env\.[A-Z_]*(KEY|SECRET|TOKEN)/);
  });

  /**
   * ÖLÇÜLDÜ (25 Eyl 2026): uç dışarıya açık (hesap.viamood.com.tr/api/health → 200) ve
   * yanıtı `kargolab.meta.userId` / `memberId` taşıyordu — üçüncü kişinin iç kimlikleri.
   * Aşağıdaki iddia SAHTE YANIT üzerinde ölçülür: alan geri konursa test KIRILIR.
   */
  const yasakli = /\b(userId|memberId|email|e-?posta|customerId|orderId|password|token)\b/i;

  it('NEGATİF: yanıta iç kimlik alanı konursa çivi KIRILIR (sahte yanıtla ölçüldü)', () => {
    const kirliYanit = {
      status: 'healthy',
      checks: { kargolab: { ok: true, meta: { userId: 4213, memberId: 991 } } },
    };
    expect(
      yasakli.test(JSON.stringify(kirliYanit)),
      'kirli yanıt yakalanmadı — iddia kör',
    ).toBe(true);

    const temizYanit = {
      status: 'healthy',
      buildId: 'lujkrNnRpmc8kwa05ZiWL',
      uptimeSec: 1234,
      checks: { db: { ok: true, latencyMs: 3 }, kargolab: { ok: true, latencyMs: 41 } },
      timestamp: '2026-09-25T15:00:00.000Z',
    };
    expect(yasakli.test(JSON.stringify(temizYanit)), 'temiz yanıt yanlışlıkla yakalandı').toBe(false);
  });

  it('kaynakta iç kimlik alanı ÜRETİLMİYOR (meta/userId/memberId yok)', () => {
    const uc = readFileSync(path.join(KOK, 'src/app/api/health/route.ts'), 'utf8');
    const kod = uc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    expect(kod, 'yanıt gövdesinde iç kimlik alanı var').not.toMatch(/meta:|userId|memberId/);
  });

  it('DEPLOY SÖZLEŞMESİ korunuyor: sağlıklıyken 200, bozukken 503', () => {
    const uc = readFileSync(path.join(KOK, 'src/app/api/health/route.ts'), 'utf8');
    expect(uc).toMatch(/status:\s*allOk\s*\?\s*200\s*:\s*503/);
    expect(uc).toContain("status: allOk ? 'healthy' : 'degraded'");
  });

  it('hata metni ham dönmüyor — yalnız sınıf adı', () => {
    const uc = readFileSync(path.join(KOK, 'src/app/api/health/route.ts'), 'utf8');
    expect(uc, 'ham hata mesajı yanıta giriyor').not.toMatch(/error:\s*err instanceof Error \? err\.message/);
    expect(uc).toContain('hataSinifi');
  });
});
