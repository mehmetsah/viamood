import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RET_ANAHTARI, RET_CEREZI, RET_CEREZ_OMRU, RET_METINLERI, retMetni } from '@/lib/ret-bildirim';
const oku = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * #992119-H · G turunda ölçüldü: server action POST yolunda `?hata=` parametresi
 * kayboluyor, kullanıcı sessizce /hesabim'a düşüyordu. Anahtar artık tek seferlik
 * çerezle de taşınıyor.
 */
describe('POST yolunda yetki reddi bildirimi', () => {
  const mw = oku('src/middleware.ts');
  const hes = oku('src/app/hesabim/page.tsx');
  const act = oku('src/lib/actions/urun-sss.ts');

  it('middleware HEM sorgu HEM çerez ile anahtarı taşıyor', () => {
    expect(mw).toContain('{ hata: RET_ANAHTARI }');
    // ⚠ DARALTILDI: "metin geçiyor mu" körü. `if (false) yanit.cookies.set(...)` de
    //   o iddiayı geçiyordu (mutant çıkış 0). Çağrının KOŞULSUZ olduğunu ölçüyoruz.
    expect(mw).toMatch(/^\s*yanit\.cookies\.set\(RET_CEREZI, RET_ANAHTARI,/m);
    expect(mw).not.toMatch(/\)\s*yanit\.cookies\.set\(/);
  });

  it('çerez METİN taşımıyor — yalnız anahtar', () => {
    expect(mw).not.toContain('Bu işlem için yetkiniz yok');
    expect(RET_ANAHTARI).toBe('yetkisiz');
    expect(RET_ANAHTARI).not.toContain(' ');
  });

  it('çerez kısa ömürlü (≤60 sn) ve HttpOnly değil', () => {
    expect(RET_CEREZ_OMRU).toBeLessThanOrEqual(60);
    expect(mw).toContain('httpOnly: false');
    expect(mw).toContain('maxAge: RET_CEREZ_OMRU');
  });

  it('tanınmayan anahtar → hiçbir şey gösterilmez', () => {
    expect(retMetni('bilinmeyen')).toBeNull();
    expect(retMetni('')).toBeNull();
    expect(retMetni(null)).toBeNull();
    expect(retMetni(undefined)).toBeNull();
    expect(retMetni(RET_ANAHTARI)).toBeTruthy();
  });

  it('sayfa çerezi okuyor ve TEK SEFERLİK siler', () => {
    expect(hes).toContain('kutu.get(RET_CEREZI)?.value');
    expect(hes).toContain('Max-Age=0');
  });

  it('metin TEK KAYNAK: action ile sayfa aynı dizeyi kullanıyor', () => {
    expect(act).toContain('RET_METINLERI[RET_ANAHTARI]');
    expect(hes).toContain("from '@/lib/ret-bildirim'");
    expect(RET_METINLERI[RET_ANAHTARI]).toBe('Bu işlem için yetkiniz yok. Yetki talebi için yöneticinize başvurun.');
  });

  it('SIZDIRMA YOK: metin iç ayrıntı vermiyor', () => {
    const metin = (RET_METINLERI[RET_ANAHTARI] ?? '').toLowerCase();
    for (const s of ['urun_sss', 'user_yetkileri', 'sss_editor', 'digest', 'stack', 'admin', 'tablo', 'sütun', 'sql']) {
      expect(metin, `"${s}" sızdırmamalı`).not.toContain(s);
    }
    // çerez adı da sızdırmamalı
    expect(RET_CEREZI.toLowerCase()).not.toContain('sss');
  });

  it('güvenlik BOZULMADI: dört eylem hâlâ kapıdan geçiyor', () => {
    expect(act.match(/await yetkiKapisi\(handle\);/g)?.length).toBe(4);
  });
});
