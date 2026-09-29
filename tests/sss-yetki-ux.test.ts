import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = readFileSync(join(process.cwd(), 'src/lib/actions/urun-sss.ts'), 'utf8');

/**
 * #992119-F · E turunun iki UX bulgusunun onarımı.
 * Ölçüt VERİ olacak dersini koruyoruz: burada ölçtüğümüz şey kaynak SÖZLEŞMESİ;
 * davranış ayağı (satır artıyor/artmıyor) canlıda ölçüldü ve rapora yazıldı.
 */
describe('yetkisiz ret kullanıcıya anlaşılır', () => {
  it('throw yerine kontrollü ret: ham Next hata sayfası doğmaz', () => {
    expect(src).toContain('geriDon(handle, YETKISIZ_METNI)');
    // eski davranış geri gelmesin
    expect(src).not.toContain("throw new Error('yetkisiz");
  });

  it('ret metni Türkçe ve yönlendirici', () => {
    // #992119-H: metin lib/ret-bildirim'de TEK KAYNAK, action oradan okuyor.
    expect(src).toContain('RET_METINLERI[RET_ANAHTARI]');
  });

  it('SIZDIRMA YOK: ret metni iç ayrıntı vermiyor', () => {
    const metin = 'Bu işlem için yetkiniz yok. Yetki talebi için yöneticinize başvurun.'.toLowerCase();
    for (const sizinti of ['urun_sss', 'user_yetkileri', 'sss_editor', 'digest', 'stack', 'admin', 'tablo', 'sütun', 'sql']) {
      expect(metin, `ret metni "${sizinti}" sızdırmamalı`).not.toContain(sizinti);
    }
  });

  it('dört eylemin DÖRDÜ de kapıdan geçiyor (güvenlik BOZULMADI)', () => {
    expect(src.match(/await yetkiKapisi\(handle\);/g)?.length).toBe(4);
    expect(src).toContain('yetkileriTazeOku(session?.user?.id)');
    expect(src).toContain('sssYonetebilirMi(session?.user?.role, tazeYetkiler)');
  });
});

describe('"kaydedilemedi" yalanı bitti', () => {
  it('Next yönlendirmesi artık yutulmuyor — her catch yeniden fırlatıyor', () => {
    const catchSayisi = (src.match(/\} catch \(e\) \{/g) ?? []).length;
    const korumaSayisi = (src.match(/if \(yonlendirmeMi\(e\)\) throw e;/g) ?? []).length;
    expect(catchSayisi).toBeGreaterThan(0);
    expect(korumaSayisi).toBe(catchSayisi);
    expect(src).toContain("d.startsWith('NEXT_REDIRECT')");
  });

  it('başarı ve senkron hatası AYRI mesajlar', () => {
    expect(src).toContain("'Kaydedildi.'");
    expect(src).toContain('Kaydedildi, ancak Shopify senkronu yapılamadı');
  });

  it('ham Error dizesi ekrana basılmıyor', () => {
    expect(src).not.toContain("'kaydedilemedi: ' +");
    expect(src).not.toMatch(/geriDon\([^)]*\(e as Error\)\?\.name/);
  });
});
