import { describe, it, expect } from 'vitest';
import { adminYoluAcikMi, sssYonetebilirMi, tamAdminMi, SSS_EDITOR, SSS_YOL } from '@/lib/yetki';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #992119-B · Yetki tablosu (geri alınabilir yol).
 * Ölçülen gerçek: `user_role` bir enum ve 'sss_editor' içinde YOK, enum'a eklenen değer
 * de geri alınamaz. Bu yüzden yetki `user_yetkileri` tablosundan geliyor.
 */
describe('B şıkkı — yetki kaydıyla SSS yönetimi', () => {
  it('(i) yetki kaydı OLMAYAN customer REDDEDİLİR', () => {
    expect(sssYonetebilirMi('customer', [])).toBe(false);
    expect(sssYonetebilirMi('customer', null)).toBe(false);
    expect(sssYonetebilirMi('customer', undefined)).toBe(false);
    expect(sssYonetebilirMi('customer', ['baska_yetki'])).toBe(false);
    expect(adminYoluAcikMi('customer', SSS_YOL, [])).toBe(false);
  });

  it('(ii) yetki kaydı OLAN customer GEÇER — B şıkkının tüm gerekçesi', () => {
    expect(sssYonetebilirMi('customer', [SSS_EDITOR])).toBe(true);
    expect(sssYonetebilirMi('customer', ['baska', SSS_EDITOR])).toBe(true);
    expect(adminYoluAcikMi('customer', SSS_YOL, [SSS_EDITOR])).toBe(true);
    // ama YALNIZ SSS yolu — yetki kaydı tüm admini açmaz
    expect(adminYoluAcikMi('customer', '/admin/orders', [SSS_EDITOR])).toBe(false);
    expect(tamAdminMi('customer')).toBe(false);
  });

  it('(iii) yetki GERİ ALININCA tekrar reddedilir', () => {
    const once = sssYonetebilirMi('customer', [SSS_EDITOR]);
    const sonra = sssYonetebilirMi('customer', []); // kayıt silindi
    expect(once).toBe(true);
    expect(sonra).toBe(false);
    expect(adminYoluAcikMi('customer', SSS_YOL, [])).toBe(false);
  });

  it('GERİLEME YOK — admin/super_admin yetki kaydı olmadan da girer', () => {
    for (const rol of ['admin', 'super_admin']) {
      expect(sssYonetebilirMi(rol, [])).toBe(true);
      expect(adminYoluAcikMi(rol, '/admin/orders', [])).toBe(true);
    }
    // enum ileride genişletilirse (A şıkkı) rol yolu da çalışmaya devam etmeli
    expect(sssYonetebilirMi(SSS_EDITOR, [])).toBe(true);
  });

  it('ÜÇ KAPI da AYNI fonksiyonu çağırıyor ve yetkileri GEÇİYOR', () => {
    const oku = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    expect(oku('src/middleware.ts')).toContain('adminYoluAcikMi(role, pathname, yetkiler)');
    expect(oku('src/app/admin/layout.tsx')).toContain('sssYonetebilirMi(role, yetkiler)');
    const act = oku('src/lib/actions/urun-sss.ts');
    expect(act).toMatch(/sssYonetebilirMi\(session\?\.user\?\.role,[\s\S]{0,90}yetkiler/);
    expect(act.match(/await yetkiKapisi\(\);/g)?.length).toBe(4);
  });

  it('GÖÇ geri alınabilir: down bloğu DROP TABLE içeriyor, enum genişletilmiyor', () => {
    const g = readFileSync(join(process.cwd(), 'drizzle/0029_user_yetkileri.sql'), 'utf8');
    expect(g).toContain('CREATE TABLE IF NOT EXISTS "user_yetkileri"');
    expect(g).toContain('DROP TABLE IF EXISTS "user_yetkileri"');
    expect(g).not.toContain('ALTER TYPE');
  });
});
