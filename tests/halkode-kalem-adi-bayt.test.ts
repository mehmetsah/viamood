/**
 * ÇİVİ — POS kalem adı: BAYT sınırı + karakteri bölmeme + Türkçe bozulmama.
 *
 * ÖLÇÜLEN ARIZA (26 Eyl 2026, #991458): `name.slice(0, 100)` karakter kesiyordu;
 * 81 harflik Türkçe bir ad 161 BYTE olarak gidiyordu ve 100. kod birimi yarım
 * surrogate olabiliyordu.
 *
 * ⚠ HEX SABİTİ KULLANILIYOR, round-trip DEĞİL: `Buffer.from(x).toString()` gibi
 * simetrik bir karşılaştırma, kodlamanın iki yönde AYNI biçimde bozulduğu hâle
 * KÖRDÜR (#991433 dersi). Beklenen byte dizisi elle yazılır.
 */
import { describe, it, expect } from 'vitest';
import { kalemAdiKirp, KALEM_ADI_BAYT_SINIRI } from '../src/lib/halkode/kalem-adi';

const hex = (s: string) => Buffer.from(s, 'utf8').toString('hex');

describe('Türkçe karakterler POS gövdesinde BOZULMAZ (HEX imzası)', () => {
  it('ı İ ş Ş ğ Ğ ç Ç ö Ö ü Ü bilinen UTF-8 imzalarını korur', () => {
    expect(hex(kalemAdiKirp('ıİşŞğĞçÇöÖüÜ'))).toBe(
      'c4b1' + 'c4b0' + 'c59f' + 'c59e' + 'c49f' + 'c49e' + 'c3a7' + 'c387' + 'c3b6' + 'c396' + 'c3bc' + 'c39c',
    );
  });

  it('gerçek ürün adı HEX olarak aynen geçer', () => {
    // "Kırılmaz" → 4b c4b1 72 c4b1 6c 6d 61 7a
    expect(hex(kalemAdiKirp('Kırılmaz'))).toBe('4bc4b172c4b16c6d617a');
  });

  it('JSON gövdesi Türkçe adı byte dizisi olarak İÇERİR', () => {
    const govde = Buffer.from(JSON.stringify({ name: kalemAdiKirp('Kırılmaz Saklama Kabı') }), 'utf8');
    expect(govde.includes(Buffer.from('Kırılmaz Saklama Kabı', 'utf8'))).toBe(true);
  });
});

describe('BAYT sınırı — karakter sınırı DEĞİL', () => {
  it('81 karakterlik Türkçe ad 100 BYTE sınırına indirilir', () => {
    const uzun = 'Ş'.repeat(81); // 162 byte
    const k = kalemAdiKirp(uzun);
    expect(Buffer.byteLength(uzun, 'utf8')).toBe(162);
    expect(Buffer.byteLength(k, 'utf8'), 'byte sınırı aşılıyor — karakter kesilmiş').toBeLessThanOrEqual(100);
    // Negatif: eski davranış (karakter kesme) 81 karakter × 2 byte = 162 bırakırdı.
    expect(Buffer.byteLength(k, 'utf8')).not.toBe(162);
  });

  it('sınır altındaki ad AYNEN kalır (gereksiz kırpma yok)', () => {
    const ad = 'Çöp Poşeti 30 lt';
    expect(kalemAdiKirp(ad)).toBe(ad);
  });

  it('sınır tam 100 byte ise dokunulmaz', () => {
    const ad = 'A'.repeat(100);
    expect(kalemAdiKirp(ad)).toBe(ad);
    expect(Buffer.byteLength(kalemAdiKirp(ad), 'utf8')).toBe(100);
  });

  it('KALEM_ADI_BAYT_SINIRI 100', () => {
    expect(KALEM_ADI_BAYT_SINIRI).toBe(100);
  });
});

describe('Karakter ORTADAN BÖLÜNMEZ (yarım surrogate / yarım UTF-8 yok)', () => {
  it('surrogate çifti bölünmez', () => {
    const ad = 'A'.repeat(99) + '😀'; // slice(0,100) yarım surrogate bırakırdı
    const k = kalemAdiKirp(ad);
    expect(/[\uD800-\uDBFF]$/.test(k), 'sonda yarım surrogate kaldı').toBe(false);
  });

  it('BÜTÇE surrogate YARISINA yetip TAMAMINA yetmediğinde de bölmez', () => {
    // ⚠ ÖLÇÜLDÜ (26 Eyl 2026): üstteki iddia kod-birimi döngüsüne KÖRDÜ.
    // 99 'A' + emoji'de yarım surrogate 3 byte, bütçe 1 byte kalır ve döngü
    // zaten kırılır — koruma olmasa da test yeşil kalıyordu (MUT-B çıkış 0).
    // Gerçek kırılma noktası: bütçeden TAM 3 byte kaldığı hâl. 97 'A' = 97 byte,
    // kalan 3 byte yarım surrogate'i (U+FFFD olarak 3 byte) alır, ikinci yarıya
    // yer kalmaz → kod birimi üzerinde yürüyen bir döngü sonda yarım karakter bırakır.
    const ad = 'A'.repeat(97) + '😀';
    const k = kalemAdiKirp(ad);
    expect(/[\uD800-\uDBFF]$/.test(k), 'sonda yarım surrogate kaldı').toBe(false);
    expect(k).not.toContain('\uFFFD');
    expect(k).toBe('A'.repeat(97));
  });

  it('çıktı geçerli UTF-8 — U+FFFD üretmez', () => {
    const ad = 'Ş'.repeat(60) + '😀'.repeat(10);
    const k = kalemAdiKirp(ad);
    expect(k).not.toContain('�');
    // Byte dizisini geri çözmek aynı metni vermeli (burada round-trip MEŞRU:
    // iddia kodlama doğruluğu değil, KESME noktasının geçerliliği).
    expect(Buffer.from(k, 'utf8').toString('utf8')).toBe(k);
  });

  it('iki byte\'lık harfin ortasında kesmez', () => {
    const ad = 'ş'.repeat(51); // 102 byte → 50 harf (100 byte) kalmalı
    const k = kalemAdiKirp(ad);
    expect(k.length).toBe(50);
    expect(Buffer.byteLength(k, 'utf8')).toBe(100);
  });
});

describe('Kenar durumlar', () => {
  it('boş/null/undefined boş dize döner', () => {
    expect(kalemAdiKirp('')).toBe('');
    expect(kalemAdiKirp(null)).toBe('');
    expect(kalemAdiKirp(undefined)).toBe('');
    expect(kalemAdiKirp('   ')).toBe('');
  });

  it('katlanmış boşluk tek boşluğa iner', () => {
    expect(kalemAdiKirp('Saklama    Kabı\n\tSeti')).toBe('Saklama Kabı Seti');
  });
});
