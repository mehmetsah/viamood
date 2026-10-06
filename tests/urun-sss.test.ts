/**
 * ÇİVİ — ürün SSS doğrulama ve sıralama (#991833).
 *
 * Saf katman `src/lib/urun-sss.ts` hem admin eylemleri hem yayın ucu tarafından
 * kullanılıyor; iki yerde ayrı yazılsa biri güncellenmeyince sessizce ayrışırdı.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { handleTemizle, sssDogrula, sssSirala, siralariSikistir, SORU_EN_UZUN, CEVAP_EN_UZUN } from '../src/lib/urun-sss';

describe('handle temizleme — tam adres yapıştırsa da çalışır', () => {
  it('ürün adresinin son parçasını çıkarır', () => {
    expect(handleTemizle('kirilmaz-saklama-kabi')).toBe('kirilmaz-saklama-kabi');
    expect(handleTemizle('/products/kirilmaz-saklama-kabi')).toBe('kirilmaz-saklama-kabi');
    expect(handleTemizle('products/kirilmaz-saklama-kabi/')).toBe('kirilmaz-saklama-kabi');
  });
  it('büyük harf ve boşluk düşer', () => {
    expect(handleTemizle('  Kirilmaz-Saklama  ')).toBe('kirilmaz-saklama');
  });
  it('tehlikeli karakter kalmaz (SQL/yol enjeksiyonuna malzeme vermez)', () => {
    expect(handleTemizle("abc' OR 1=1--")).toBe('abcor11--');
    expect(handleTemizle('../../etc/passwd')).toBe('etcpasswd');
  });
  it('boş/null boş dize döner', () => {
    expect(handleTemizle('')).toBe('');
    expect(handleTemizle(null)).toBe('');
    expect(handleTemizle(undefined)).toBe('');
  });
});

describe('doğrulama — NEGATİF iddialar', () => {
  it('geçerli girdi kayda çevrilir, boşluk katlanır', () => {
    const r = sssDogrula({ soru: '  Makinede   yıkanır mı? ', cevap: ' Evet. ' });
    expect('kayit' in r && r.kayit).toEqual({ soru: 'Makinede yıkanır mı?', cevap: 'Evet.', sira: 0 });
  });
  it('boş soru ya da cevap REDDEDİLİR', () => {
    expect(sssDogrula({ soru: '', cevap: 'x' })).toEqual({ hata: 'soru boş olamaz' });
    expect(sssDogrula({ soru: '  ', cevap: 'x' })).toEqual({ hata: 'soru boş olamaz' });
    expect(sssDogrula({ soru: 'x', cevap: '' })).toEqual({ hata: 'cevap boş olamaz' });
  });
  it('HTML ETİKETİ reddedilir — stored XSS kapısı', () => {
    const r1 = sssDogrula({ soru: '<script>alert(1)</script>', cevap: 'x' });
    expect('hata' in r1 && r1.hata).toMatch(/HTML/);
    const r2 = sssDogrula({ soru: 'x', cevap: 'şu <b>kalın</b> yazı' });
    expect('hata' in r2, 'cevapta HTML geçti — ürün sayfasına script sokulabilir').toBe(true);
    const r3 = sssDogrula({ soru: 'x', cevap: '<img src=x onerror=alert(1)>' });
    expect('hata' in r3).toBe(true);
  });
  it('düz metinde < işareti tek başına sorun değil (2 < 3 gibi)', () => {
    expect('kayit' in sssDogrula({ soru: '2 < 3 mü?', cevap: 'evet' })).toBe(true);
  });
  it('uzunluk sınırları', () => {
    expect('hata' in sssDogrula({ soru: 'a'.repeat(SORU_EN_UZUN + 1), cevap: 'x' })).toBe(true);
    expect('hata' in sssDogrula({ soru: 'a'.repeat(SORU_EN_UZUN), cevap: 'x' })).toBe(false);
    expect('hata' in sssDogrula({ soru: 'x', cevap: 'a'.repeat(CEVAP_EN_UZUN + 1) })).toBe(true);
  });
  it('sıra negatif/ondalık/çöp gelirse 0\'a düşer', () => {
    for (const v of [-5, 'abc', null, NaN] as unknown[]) {
      const r = sssDogrula({ soru: 'x', cevap: 'y', sira: v as number });
      expect('kayit' in r && r.kayit.sira).toBe(0);
    }
    const r = sssDogrula({ soru: 'x', cevap: 'y', sira: 3.7 });
    expect('kayit' in r && r.kayit.sira).toBe(3);
  });
});

describe('sıralama BELİRLİ olmalı', () => {
  const l = [
    { sira: 1, soru: 'B sorusu' },
    { sira: 0, soru: 'A sorusu' },
    { sira: 1, soru: 'A ikinci' },
  ];
  it('sira artan, eşitlikte Türkçe alfabetik', () => {
    expect(sssSirala(l).map((k) => k.soru)).toEqual(['A sorusu', 'A ikinci', 'B sorusu']);
  });
  it('girdi dizisi DEĞİŞTİRİLMEZ', () => {
    const kopya = JSON.parse(JSON.stringify(l));
    sssSirala(l);
    expect(l).toEqual(kopya);
  });
  it('sıkıştırma 0,1,2… dizer (silme sonrası boşluk kapanır)', () => {
    expect(siralariSikistir([{ sira: 5, soru: 'a' }, { sira: 9, soru: 'b' }]).map((k) => k.sira)).toEqual([0, 1]);
  });
});

describe('ÜRÜN KAYNAĞI — kurallar tek yerden mi geliyor', () => {
  const KOK = path.resolve(__dirname, '..');
  const EYLEM = readFileSync(path.join(KOK, 'src/lib/actions/urun-sss.ts'), 'utf8');
  const UC = readFileSync(path.join(KOK, 'src/app/api/v1/urun-sss/route.ts'), 'utf8');

  it('admin eylemi doğrulamayı SAF katmandan alıyor (kopya yazmıyor)', () => {
    expect(EYLEM).toMatch(/import \{[^}]*sssDogrula[^}]*\} from '@\/lib\/urun-sss'/);
    expect(EYLEM, 'eylemde kendi HTML denetimi yazılmış — kopya sapar').not.toMatch(/<\[a-z/);
  });

  it('yayın ucu yalnız AÇIK kayıtları döndürüyor', () => {
    expect(UC).toMatch(/eq\(urunSss\.acik, true\)/);
  });

  it('yayın ucu sıralamayı SAF katmandan alıyor', () => {
    expect(UC).toMatch(/sssSirala\(/);
  });

  it('göç koşmadıysa uç ÇÖKMEZ, boş liste döner', () => {
    const i = UC.indexOf('catch');
    expect(i).toBeGreaterThan(-1);
    expect(UC.slice(i, i + 200)).toMatch(/sss: \[\]/);
  });

  it('silme sonrası sıralar yeniden diziliyor (tekil kısıt çakışmasın)', () => {
    expect(EYLEM).toMatch(/sira: -1000 - i/);
  });
});
