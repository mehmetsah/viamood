/**
 * #992317 halka #4 — /admin/davet yetki kapıları.
 * Kaynak metni üzerinden ölçülür (modüller @/db/client çekiyor, DATABASE_URL yok).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SAYFA = readFileSync('src/app/admin/davet/page.tsx', 'utf8');
const ACTION = readFileSync('src/lib/actions/davet-olustur.ts', 'utf8');
const YETKI = readFileSync('src/lib/yetki.ts', 'utf8');

/** Yorumları at — gerekçe metninde geçen `console.log(link)` uyarısı KOD değildir. */
const kodu = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('/admin/davet — yalnız tam admin', () => {
  it('sayfa ikinci kapıyı koyuyor (tamAdminMi değilse redirect)', () => {
    expect(SAYFA).toContain('tamAdminMi(session?.user?.role)');
    expect(SAYFA).toMatch(/if \(!tamAdminMi\([^)]*\)\) redirect\(/);
  });
  it('NEGATİF: action ÜÇÜNCÜ kapıyı da koyuyor — form POST taklit edilse bile düşer', () => {
    expect(ACTION).toContain('tamAdminMi(session?.user?.role)');
    expect(ACTION).toMatch(/return \{ ok: false, hata: 'Bu işlem için yetkin yok\.' \}/);
  });
  it('NEGATİF: sss_editor tam admin SAYILMAZ (kapıların dayandığı değişmez)', () => {
    const m = YETKI.match(/TAM_ADMIN_ROLLER\s*=\s*\[([^\]]*)\]/);
    expect(m, 'TAM_ADMIN_ROLLER bulunamadı').toBeTruthy();
    expect(m![1]).not.toContain('sss_editor');
  });
});

describe('/admin/davet — rol yükseltme kapalı', () => {
  it('NEGATİF: istemciden gelen rol beyaz listeye vuruluyor', () => {
    expect(ACTION).toContain('DAVET_EDILEBILIR_ROLLER as readonly string[]).includes(role)');
  });
  it('NEGATİF: admin/super_admin metinleri action’da hiç geçmiyor (kazara eklenmemiş)', () => {
    expect(kodu(ACTION)).not.toMatch(/'(super_)?admin'/);
  });
});

describe('/admin/davet — link sızdırma yok', () => {
  it('NEGATİF: ham link LOG’LANMIYOR', () => {
    expect(kodu(ACTION)).not.toMatch(/console\./);
    expect(kodu(SAYFA)).not.toMatch(/console\./);
  });
});
