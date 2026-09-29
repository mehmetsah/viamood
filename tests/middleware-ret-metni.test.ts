import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const oku = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * #992119-G · F turunun bulgusu: yetkisiz gönderimde kullanıcı sessizce /hesabim'a
 * atılıyordu, hiçbir açıklama görmüyordu ("tıkladım, hiçbir şey olmadı").
 */
describe('middleware yetki reddi anlaşılır', () => {
  const mw = oku('src/middleware.ts');
  const hes = oku('src/app/hesabim/page.tsx');

  it('middleware yönlendirmesi ?hata=yetkisiz ANAHTARI taşıyor', () => {
    expect(mw).toContain("{ hata: 'yetkisiz' }");
  });

  it('URL metnin KENDİSİNİ taşımıyor — yalnız anahtar', () => {
    expect(mw).not.toContain('Bu işlem için yetkiniz yok');
  });

  it('metin hedef sayfada SABİT, URL den gelmiyor', () => {
    expect(hes).toContain("yetkisiz: 'Bu işlem için yetkiniz yok. Yetki talebi için yöneticinize başvurun.'");
    expect(hes).toContain('const metin = anahtar ? RET_METINLERI[anahtar] : undefined');
    expect(hes).toContain('if (!metin) return null');
  });

  it('SIZDIRMA YOK: ret metni iç ayrıntı vermiyor', () => {
    const m = hes.match(/yetkisiz: '([^']+)'/);
    expect(m).toBeTruthy();
    const metin = (m![1] ?? '').toLowerCase();
    for (const s of ['urun_sss', 'user_yetkileri', 'sss_editor', 'digest', 'stack', 'admin', 'tablo', 'sütun', 'sql']) {
      expect(metin, `"${s}" sızdırmamalı`).not.toContain(s);
    }
  });

  it('bildirim HER İKİ sipariş dalında da basılıyor', () => {
    expect((hes.match(/<RetBildirimi anahtar=/g) ?? []).length).toBe(2);
  });

  it('server action ret metniyle AYNI dil', () => {
    const act = oku('src/lib/actions/urun-sss.ts');
    const m1 = act.match(/const YETKISIZ_METNI = '([^']+)'/)?.[1];
    const m2 = hes.match(/yetkisiz: '([^']+)'/)?.[1];
    expect(m1).toBe(m2);
  });

  it('ölü kod temizlendi: admin dalında tek redirect var', () => {
    const blok = mw.slice(mw.indexOf('if (!adminYoluAcikMi'), mw.indexOf('return NextResponse.next();', mw.indexOf('if (!adminYoluAcikMi')));
    expect((blok.match(/return NextResponse\.redirect/g) ?? []).length).toBe(1);
  });
});
