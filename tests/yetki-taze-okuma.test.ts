import { describe, it, expect } from 'vitest';
import { sssYonetebilirMi, SSS_EDITOR } from '@/lib/yetki';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const oku = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * #992119-D · ÖLÇÜLEN AÇIK: yetki `user_yetkileri`'nden silindikten sonra açık oturum
 * hem SSS sayfasını açmaya hem yazma action'ını çalıştırmaya DEVAM ETTİ (29 Eyl, canlı).
 * Sebep: yetkiler JWT'de taşınıyordu, `maxAge` 7 gün. Onarım: KAPI 2 ve 3 DB'den taze okur.
 */
describe('yetki taze okuma — JWT tazelik açığı', () => {
  it('(i) yetki DB de YOKKEN karar RET', () => {
    expect(sssYonetebilirMi('customer', [])).toBe(false);
    expect(sssYonetebilirMi('customer', null)).toBe(false);
  });

  it('(ii) yetki DB de VARKEN karar GEÇER', () => {
    expect(sssYonetebilirMi('customer', [SSS_EDITOR])).toBe(true);
  });

  it('(iii) JWT de VAR ama DB de YOK → RET (açığın tam kendisi)', () => {
    // Kapılar artık JWT listesini HİÇ okumuyor; karara giren tek şey DB'den gelen liste.
    const jwtListesi = [SSS_EDITOR]; // eski oturumda duruyor
    const dbListesi: string[] = []; // yetki geri alındı
    expect(sssYonetebilirMi('customer', dbListesi)).toBe(false);
    // ve JWT listesi karara SOKULMUYOR — kaynakta kanıtı aşağıdaki sözleşme testinde
    expect(jwtListesi.includes(SSS_EDITOR)).toBe(true); // JWT'de hâlâ var, ama önemi yok
  });

  it('(iv) DB de VAR ama JWT de YOK → GEÇER (yeni verilen yetki anında işler)', () => {
    expect(sssYonetebilirMi('customer', [SSS_EDITOR])).toBe(true);
  });

  it('SÖZLEŞME: KAPI 2 ve KAPI 3 DB den taze okuyor, JWT listesini KULLANMIYOR', () => {
    const act = oku('src/lib/actions/urun-sss.ts');
    expect(act).toContain('yetkileriTazeOku(session?.user?.id)');
    expect(act).toContain('sssYonetebilirMi(session?.user?.role, tazeYetkiler)');
    // JWT'deki yetkiler artık karara girmemeli
    expect(act).not.toMatch(/yetkiler\?\.\s*\)/);
    expect(act).not.toContain('{ yetkiler?: string[] } | undefined)?.yetkiler');

    const lay = oku('src/app/admin/layout.tsx');
    expect(lay).toContain('yetkileriTazeOku(session?.user?.id)');
    expect(lay).not.toContain('{ yetkiler?: string[] } | undefined)?.yetkiler');
  });

  it('SÖZLEŞME: KAPI 1 (middleware) BİLEREK JWT de kaldı — Edge de DB yok', () => {
    const mw = oku('src/middleware.ts');
    expect(mw).toContain('adminYoluAcikMi(role, pathname, yetkiler)');
    expect(mw).not.toContain('yetkileriTazeOku'); // Edge'de DB sorgusu YAPILAMAZ
  });

  it('SÖZLEŞME: JWT maxAge DEĞİŞTİRİLMEDİ (ayrı karar, Mehmet Şah ın işi)', () => {
    expect(oku('src/lib/auth.config.ts')).toContain('maxAge: 60 * 60 * 24 * 7');
  });

  it('taze okuma tablo yoksa GÜVENLİ tarafa düşer: boş liste, yetki VERMEZ', () => {
    const src = oku('src/lib/yetki-taze.ts');
    expect(src).toContain('catch {');
    expect(src).toMatch(/return \[\];/);
    expect(sssYonetebilirMi('customer', [])).toBe(false);
  });
});
