/**
 * ÇİVİ — TEST ve CANLI deneme sayfaları `?sepet=coklu` için SİMETRİK olmalı.
 *
 * ÖLÇÜLEN ARIZA (26 Eyl 2026, Elif · #991458b): canlı-deneme route'u `sepet`
 * parametresini okuyup `kalemler` prop'unu geçiyordu, TEST route'u okumuyordu.
 * Dışarıdan ölçüm: /odeme/halkode-test/<anahtar>?sepet=coklu → "10.00 TL ·
 * Sepet ya da ürün gerekmez", "Sepet özeti" bloğu YOK. Yani çok kalemli akışı
 * görmenin tek yolu GERÇEK PARA çeken canlı sayfaydı; oysa arka uç
 * (test-initialize) `coklu`'yu ortamdan BAĞIMSIZ destekliyor.
 *
 * Bu çivi kaynak eşleştirmesiyle ölçer: parametre okunuyor mu, kalemler
 * geçiliyor mu, tutar koşullu mu. Ekran/tasarım iddiası YOK.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const yol = (d: string) => path.join(KOK, `src/app/(storefront)/odeme/${d}/[anahtar]/page.tsx`);
const TEST = readFileSync(yol('halkode-test'), 'utf8');
const CANLI = readFileSync(yol('halkode-canli'), 'utf8');

describe('deneme route simetrisi — ?sepet=coklu iki sayfada da işler', () => {
  for (const [ad, kaynak] of [['TEST', TEST], ['CANLI', CANLI]] as const) {
    it(`${ad} sayfası sepet parametresini OKUYOR`, () => {
      expect(kaynak, `${ad} route'u ?sepet=coklu'yu yoksayıyor`).toMatch(/sp\?\.sepet === 'coklu'/);
    });

    it(`${ad} sayfası kalemler prop'unu koşullu GEÇİYOR`, () => {
      expect(kaynak, `${ad} route'u kalem listesini hiç göndermiyor`).toMatch(
        /kalemler=\{coklu \? COKLU_SEPET : undefined\}/,
      );
    });

    it(`${ad} sayfası tutarı koşullu veriyor (coklu → COKLU_TUTAR_TL)`, () => {
      expect(kaynak).toMatch(/tutar=\{coklu \? COKLU_TUTAR_TL : TEST_TUTAR_TL\}/);
    });

    it(`${ad} sayfası ortamını DEĞİŞTİRMİYOR`, () => {
      // Test sayfası testapp'e, canlı sayfa app'e bağlı kalmalı; çok kalemli
      // varyant eklerken ortam karışırsa test denemesi GERÇEK PARA çeker.
      expect(kaynak).toMatch(new RegExp(`ortam="${ad === 'TEST' ? 'test' : 'canli'}"`));
    });
  }

  it('TEST sayfası sabit 10 TL\'ye ÇAKILI DEĞİL (eski hâl geri gelirse kırılır)', () => {
    expect(TEST, 'tutar sabit TEST_TUTAR_TL olarak çakılmış').not.toMatch(
      /tutar=\{TEST_TUTAR_TL\}\s+sp=/,
    );
  });

  it('parametre yoksa iki sayfa da TEK KALEM davranışını korur', () => {
    for (const k of [TEST, CANLI]) {
      expect(k).toMatch(/coklu \? COKLU_SEPET : undefined/);
      expect(k).toMatch(/coklu \? COKLU_TUTAR_TL : TEST_TUTAR_TL/);
    }
  });
});
