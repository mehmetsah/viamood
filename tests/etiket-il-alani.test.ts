/**
 * #993105 — ETİKETTE İL ALANI İLÇEYE DÜŞMEZ.
 *
 * ÖLÇÜLEN KUSUR (Yunus, 7 Eki 2026, Shopify sipariş 1206): açıklamada
 * "Mersin Yenişehir" yazarken etikette "Yenişehir" HEM il HEM ilçe görünüyordu.
 * Kök sebep src/lib/server/fulfillment-service.ts içindeydi:
 *     state: ship.district ?? ship.city      ← il yoksa İLÇEYE düşüyordu
 *     state_code: stateCodeFromName(ship.district ?? ship.city)
 * `stateCodeFromName` eşleşmeyen adda '34' (İSTANBUL) döndüğü için Mersin
 * gönderisi İstanbul plakasıyla çıkıyordu — yanlış il = paket yanlış şehre.
 *
 * Bu çivi KAYNAK METNİNİ denetler: geri çekilme geri konursa kırmızı yanar.
 * (Davranış ucu `tests/etiket-il-ilce-kapisi.test.ts`'te mock'lu olarak zaten var;
 *  burada ÖZELLİKLE o tek satırın geri gelmemesini tutuyoruz.)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KAYNAK = readFileSync(resolve(process.cwd(), 'src/lib/server/fulfillment-service.ts'), 'utf8');
/** Yorumlar soyulur: yasağı ANLATAN yorum yasağı ihlal etmiş sayılmasın. */
const KOD = KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('#993105 — il alanı ilçeye düşmez', () => {
  it('NEGATİF: `state` alanında ilçeye geri çekilme YOK', () => {
    expect(KOD, 'ship.district ?? ship.city geri geldi — ilçe il olarak basılır')
      .not.toMatch(/state:\s*ship\.district\s*\?\?\s*ship\.city/);
  });

  it('NEGATİF: `state_code` ilçe adından türetilmez (eşleşmezse 34/İstanbul olur)', () => {
    expect(KOD).not.toMatch(/stateCodeFromName\(\s*ship\.district\s*\?\?\s*ship\.city\s*\)/);
  });

  it('`state` yalnız ship.district (İL) alanından gelir', () => {
    expect(KOD, 'il tek kaynaktan: kapıdan sonra ship.district.trim()').toMatch(/const ilAdi = ship\.district\.trim\(\)/);
    expect(KOD).toMatch(/state:\s*ilAdi\s*,/);
    expect(KOD).toMatch(/state_code:\s*stateCodeFromName\(ilAdi\)/);
  });

  it('İL eksikse etiket KESİLMEZ — açık hata kapısı var', () => {
    expect(KOD).toMatch(/if\s*\(!ship\.district\?\.trim\(\)\)/);
    expect(KAYNAK).toMatch(/Teslimat adresinde İL eksik/);
  });

  it('İLÇE kapısının mesajı artık doğru alanı söylüyor (eskiden ilçeyi denetleyip "İL eksik" diyordu)', () => {
    const i = KAYNAK.indexOf("if (!ship.city?.trim())");
    expect(i).toBeGreaterThan(-1);
    expect(KAYNAK.slice(i, i + 400)).toMatch(/Teslimat adresinde İLÇE eksik/);
  });

  it('ilçeden il TÜRETİLMİYOR (tahmin ikinci yanlış etiket sınıfı doğurur)', () => {
    expect(KOD).not.toMatch(/ilden|ilceyeGoreIl|ilFromIlce|deriveProvince/i);
  });
});
