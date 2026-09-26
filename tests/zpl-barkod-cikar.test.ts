/**
 * ÇİVİ — Sürat (kurye 456) etiketinden barkod çıkarma.
 *
 * ÖLÇÜLEN TUZAK: ilk denemede `[0-9]{13}` aranmış, ZPL'deki KOMŞU bir alanın
 * 14 haneli sayısı kesilip barkod sanılmıştı ("10413999752361" → "1041399975236").
 * Doğru kaynak yalnız `^BC` komutunun kendi `^FD` alanı; oradaki `>:` de
 * Code128 subset-C geçiş dizisidir, numaranın parçası değildir.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — operasyonel betik, tip bildirimi yok
import { zplBarkodCikar } from '../scripts/takip-no-zpl-geri-yaz.mjs';

/** #1056'nın gerçek etiketinden sadeleştirilmiş kesit. */
const GERCEK = [
  '^XA^MMT^PW799',
  '^FT48,300^FD10413999752361^FS',        // komşu alan — 14 hane, barkod DEĞİL
  '^BY2,3,145^FT120,470^BCN,,Y,N',
  '^FD>:01252030791^FS',                  // barkodun kendisi
  '^FT48,600^FDSURAT KARGO^FS',
  '^XZ',
].join('\r\n');

describe('zplBarkodCikar', () => {
  it('gerçek etiketten 11 haneli barkodu çıkarır', () => {
    expect(zplBarkodCikar(GERCEK)).toBe('01252030791');
  });

  it('komşu 14 haneli alanı barkod SANMAZ (ilk turun hatası)', () => {
    expect(zplBarkodCikar(GERCEK)).not.toBe('10413999752361');
    expect(zplBarkodCikar(GERCEK)).not.toBe('1041399975236');
  });

  it('>: subset geçişi numaraya karışmaz', () => {
    expect(zplBarkodCikar('^BCN,,Y,N^FD>:01252030791^FS')).toBe('01252030791');
    expect(zplBarkodCikar('^BCN,,Y,N^FD01252030791^FS')).toBe('01252030791');
  });

  it('uzunluk 11 değilse REDDEDER — yanlış numara yazmaktansa boş', () => {
    expect(zplBarkodCikar('^BCN,,Y,N^FD>:0125203^FS')).toBeNull();
    expect(zplBarkodCikar('^BCN,,Y,N^FD>:012520307911234^FS')).toBeNull();
  });

  it('^BC yoksa null döner (barkodsuz etiket)', () => {
    expect(zplBarkodCikar('^XA^FT48,300^FD10413999752361^FS^XZ')).toBeNull();
  });

  it('boş/geçersiz girdide çökmez', () => {
    expect(zplBarkodCikar('')).toBeNull();
    expect(zplBarkodCikar(null)).toBeNull();
    expect(zplBarkodCikar(undefined)).toBeNull();
  });
});
