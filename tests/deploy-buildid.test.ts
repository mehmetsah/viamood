/**
 * BUILD_ID ÇİVİSİ — "main'de var ama canlıda yok" bir daha görünmez kalmasın.
 *
 * ÖLÇÜLEN ARIZA (25 Eyl 2026): /api/health `buildId: null` dönüyordu. Hangi commit'in
 * canlıda koştuğu ölçülemediği için, main'e alınmış bir sürümün canlıya HİÇ inmediği
 * günlerce fark edilmedi — merge kanıtı teslim kanıtı sanıldı.
 * Kapı: deploy her pm2 restart'ında commit SHA'yı NEXT_BUILD_ID olarak geçirir.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const DEPLOY = readFileSync(path.join(KOK, 'scripts/deploy.sh'), 'utf8');
const HEALTH = readFileSync(path.join(KOK, 'src/app/api/health/route.ts'), 'utf8');

describe('BUILD_ID — canlıdaki sürüm ölçülebilir olmalı', () => {
  it('sağlık ucu buildId döndürüyor ve NEXT_BUILD_ID okuyor', () => {
    expect(HEALTH).toContain('buildId: process.env.NEXT_BUILD_ID');
  });

  it('deploy HER pm2 restart\'ında NEXT_BUILD_ID geçiriyor', () => {
    const restartlar = [...DEPLOY.matchAll(/pm2 restart viamood-web --update-env/g)];
    expect(restartlar.length, 'pm2 restart satırı bulunamadı').toBeGreaterThan(0);
    // Her restart'ın hemen öncesinde NEXT_BUILD_ID ataması olmalı — biri unutulursa
    // geri dönüş dalında buildId kaybolur ve arıza geri gelir.
    for (const m of restartlar) {
      const once = DEPLOY.slice(Math.max(0, m.index! - 160), m.index!);
      expect(once, 'bir pm2 restart NEXT_BUILD_ID olmadan koşuyor').toMatch(/NEXT_BUILD_ID="\$\(git rev-parse/);
    }
  });

  it('SHA git\'ten alınıyor, elle yazılmıyor', () => {
    expect(DEPLOY).toMatch(/NEXT_BUILD_ID="\$\(git rev-parse --short HEAD[^"]*\)"/);
  });

  it('.env.production\'a YAZILMIYOR (sır dosyasına deploy dokunmaz)', () => {
    expect(DEPLOY, 'deploy .env.production\'a NEXT_BUILD_ID yazıyor').not.toMatch(
      /NEXT_BUILD_ID[^\n]*>>\s*\.env\.production/,
    );
  });

  it('sağlık ucu iç kimlik sızdırmıyor (601092d korunuyor)', () => {
    const kod = HEALTH.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    expect(kod, 'iç kimlik alanı geri gelmiş').not.toMatch(/meta:|userId|memberId/);
  });
});
