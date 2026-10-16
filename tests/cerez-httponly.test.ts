import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RET_BASLIGI, RET_CEREZI, RET_CEREZ_OMRU, RET_ANAHTARI, retMetni } from '@/lib/ret-bildirim';
const oku = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * #992119-L · K turunda ölçüldü: `vm_ret` çerezi `httpOnly` DEĞİLDİ ve silmeyi
 * tarayıcı JS'i yapıyordu. Sır taşımıyor ama XSS hâlinde saldırgan sahte bir
 * "yetkiniz yok" uyarısı kurabilirdi. Artık httpOnly ve silme sunucuda.
 */
describe('vm_ret çerezi httpOnly + sunucu tarafı silme', () => {
  const mw = oku('src/middleware.ts');
  const hes = oku('src/app/hesabim/page.tsx');

  it('çerez httpOnly kuruluyor', () => {
    const i = mw.indexOf('yanit.cookies.set(RET_CEREZI, RET_ANAHTARI');
    expect(i).toBeGreaterThan(-1);
    const blok = mw.slice(i, i + 320);
    expect(blok).toContain('httpOnly: true');
    expect(blok).not.toContain('httpOnly: false');
  });

  it('diğer bayraklar KORUNDU: secure, sameSite lax, path /, maxAge', () => {
    const i = mw.indexOf('yanit.cookies.set(RET_CEREZI, RET_ANAHTARI');
    const blok = mw.slice(i, i + 320);
    expect(blok).toContain("sameSite: 'lax'");
    expect(blok).toContain("secure: process.env.NODE_ENV === 'production'");
    expect(blok).toContain("path: '/'");
    expect(blok).toContain('maxAge: RET_CEREZ_OMRU');
    expect(RET_CEREZ_OMRU).toBeLessThanOrEqual(60);
  });

  it('SİLME SUNUCUDA: middleware okuyup aynı yanıtta düşürüyor', () => {
    expect(mw).toContain('req.cookies.get(RET_CEREZI)?.value');
    expect(mw).toContain('basliklar.set(RET_BASLIGI, retAnahtari)');
    expect(mw).toMatch(/res\.cookies\.set\(RET_CEREZI, '', \{ path: '\/', maxAge: 0 \}\)/);
  });

  it('tarayıcı JS ile silme KALKTI', () => {
    expect(hes).not.toContain('document.cookie');
    expect(hes).not.toContain('CerezDus');
    expect(hes).not.toContain('dangerouslySetInnerHTML');
  });

  it('sayfa değeri BAŞLIKTAN okuyor, çerezden değil', () => {
    expect(hes).toContain('h.get(RET_BASLIGI)');
    expect(hes).not.toContain('kutu.get(RET_CEREZI)');
    expect(hes).toContain("from 'next/headers'");
  });

  it('admin yollarında başlık AKTARILMIYOR (sonsuz döngü / erken tüketim olmasın)', () => {
    expect(mw).toContain('!pathname.startsWith(ADMIN_PREFIX)');
  });

  it('metin hâlâ TEK KAYNAK ve anahtar tanınmazsa boş', () => {
    expect(retMetni(RET_ANAHTARI)).toBeTruthy();
    expect(retMetni('uydurma')).toBeNull();
    expect(retMetni(null)).toBeNull();
  });

  it('Halköde önizleme çerezine DOKUNULMADI', () => {
    expect((mw.match(/HALKODE_PREVIEW_COOKIE/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
