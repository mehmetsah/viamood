import { describe, it, expect } from 'vitest';
import { adminYoluAcikMi, sssYonetebilirMi, tamAdminMi, SSS_EDITOR, SSS_YOL } from '@/lib/yetki';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Mehmet ŞAH 29 Eyl 2026: «SSS rolünü yaz» — Yunus'a `admin` verilmeyecek.
 * İzolasyon SUNUCUDA zorlanır; menüden gizlemek teslim sayılmaz.
 */
describe('sss_editor izolasyonu', () => {
  const BASKA_ADMIN_YOLLARI = [
    '/admin', '/admin/orders', '/admin/customers', '/admin/vendors',
    '/admin/settings', '/admin/payouts', '/admin/iade', '/admin/audit-log',
    '/admin/tenants', '/admin/mikro', '/admin/shopify',
  ];

  it('(a) sss_editor SSS ekranına GİREBİLİR', () => {
    expect(adminYoluAcikMi(SSS_EDITOR, SSS_YOL)).toBe(true);
    expect(adminYoluAcikMi(SSS_EDITOR, `${SSS_YOL}/alt`)).toBe(true);
    expect(sssYonetebilirMi(SSS_EDITOR)).toBe(true);
  });

  it('(b) sss_editor DİĞER admin ekranlarının HİÇBİRİNE giremez', () => {
    for (const yol of BASKA_ADMIN_YOLLARI) {
      expect(adminYoluAcikMi(SSS_EDITOR, yol), `sss_editor ${yol} yoluna GİRMEMELİ`).toBe(false);
    }
    expect(tamAdminMi(SSS_EDITOR)).toBe(false);
  });

  it('(c) admin ve super_admin DAVRANIŞI BOZULMADI — hepsine girebilir', () => {
    for (const rol of ['admin', 'super_admin']) {
      expect(adminYoluAcikMi(rol, SSS_YOL)).toBe(true);
      for (const yol of BASKA_ADMIN_YOLLARI) {
        expect(adminYoluAcikMi(rol, yol), `${rol} ${yol} yoluna girebilmeli`).toBe(true);
      }
      expect(sssYonetebilirMi(rol)).toBe(true);
      expect(tamAdminMi(rol)).toBe(true);
    }
  });

  it('(d) customer / vendor / vendor_admin GERİLEMEDİ — admin yolları kapalı, SSS de kapalı', () => {
    for (const rol of ['customer', 'vendor', 'vendor_admin', undefined, null, '', 'sss_editor_x']) {
      if (rol === 'sss_editor') continue;
      expect(adminYoluAcikMi(rol, SSS_YOL), `${rol} SSS'e girmemeli`).toBe(false);
      expect(adminYoluAcikMi(rol, '/admin/orders')).toBe(false);
      expect(sssYonetebilirMi(rol)).toBe(false);
    }
  });

  it('(e) URL oynamasıyla kaçış yok — benzer adlı yollar SSS sayılmaz', () => {
    for (const yol of ['/admin/urun-sss-gizli', '/admin/urun', '/admin/x/admin/urun-sss', '/admin/urun-sssx']) {
      expect(adminYoluAcikMi(SSS_EDITOR, yol), `${yol} açık OLMAMALI`).toBe(false);
    }
  });

  it('(f) ÜÇ KAPI da kaynakta bağlı — menü gizlemek yetmez', () => {
    const oku = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    // #992119-B: imzaya yetkiler eklendi — kapı hâlâ AYNI fonksiyondan geçiyor.
    expect(oku('src/middleware.ts')).toContain('adminYoluAcikMi(role, pathname, yetkiler)');
    expect(oku('src/app/admin/layout.tsx')).toContain('sssYonetebilirMi(role, yetkiler)');
    const act = oku('src/lib/actions/urun-sss.ts');
    expect(act).toContain('async function yetkiKapisi(handle: string)');
    // dört eylemin DÖRDÜ de kapıdan geçmeli
    expect(act.match(/await yetkiKapisi\(handle\);/g)?.length).toBe(4); // #992119-F: handle parametresi eklendi
  });
});
