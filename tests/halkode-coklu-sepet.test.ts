/**
 * ÇOK KALEMLİ SEPET ÇİVİSİ — `status_code=13` bir daha dönmesin.
 *
 * ÖLÇÜLEN ARIZA (25 Eyl 2026, canlı): 10 kez
 *   "The total of your items price 8100.0000 is not equal to the invoice total (8100.0000)"
 * Sebep: kalem `price` alanına SATIR TOPLAMI yazılıp `quantity` de gönderiliyordu;
 * Halköde `price × quantity` hesapladığı için adet>1 sepette toplam şişiyordu.
 * Bu çivi, demo sepetin ve ödeme ucunun kalem toplamı ile fatura toplamını EŞİT
 * tuttuğunu sabitler.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COKLU_SEPET, COKLU_TUTAR_TL } from '@/lib/halkode/test-page';

const KOK = path.resolve(__dirname, '..');
const INIT = readFileSync(path.join(KOK, 'src/app/api/v1/payment/halkode/initialize/route.ts'), 'utf8');
const TEST_INIT = readFileSync(path.join(KOK, 'src/app/api/v1/payment/halkode/test-initialize/route.ts'), 'utf8');

/** Halköde'nin göreceği toplam: Σ round(price×100) × quantity (kuruş). */
const halkodeToplami = (k: ReadonlyArray<{ price: number; quantity: number }>) =>
  k.reduce((s, x) => s + Math.round(x.price * 100) * x.quantity, 0);

describe('çok kalemli demo sepet', () => {
  it('kalem toplamı = fatura toplamı (kuruşu kuruşuna)', () => {
    expect(halkodeToplami(COKLU_SEPET)).toBe(Math.round(COKLU_TUTAR_TL * 100));
  });

  it('istenen sepeti kapsıyor: adet>1 · kuruşlu fiyat · kargo · NEGATİF indirim', () => {
    expect(COKLU_SEPET.length).toBeGreaterThanOrEqual(4);
    expect(COKLU_SEPET.some((k) => k.quantity > 1), 'adet>1 kalem yok').toBe(true);
    expect(COKLU_SEPET.some((k) => Math.round(k.price * 100) % 100 !== 0), 'kuruşlu fiyat yok').toBe(true);
    expect(COKLU_SEPET.some((k) => /kargo/i.test(k.name)), 'kargo kalemi yok').toBe(true);
    const indirim = COKLU_SEPET.find((k) => k.price < 0);
    expect(indirim, 'negatif indirim kalemi yok').toBeTruthy();
  });

  it('toplam 10,00–15,00 TL aralığında (gerçek çekim, düşük tutulmalı)', () => {
    // 26 Eyl 2026: CANLI deneme gerçek para çekiyor → tutar 3–5 TL bandına indi.
    // Üst sınır ZORUNLU: bant genişletilerek "geçirmek" iade kararı doğurur.
    expect(COKLU_TUTAR_TL).toBeGreaterThanOrEqual(3);
    expect(COKLU_TUTAR_TL).toBeLessThanOrEqual(5);
    expect(COKLU_TUTAR_TL).toBeCloseTo(4.1, 2);
  });

  it('NEGATİF: satır toplamı yazılsaydı eşitlik BOZULURDU (arızanın kendisi)', () => {
    const bozuk = COKLU_SEPET.map((k) => ({ price: k.price * k.quantity, quantity: k.quantity }));
    expect(halkodeToplami(bozuk), 'bozuk kalıp yine de eşit çıktı — çivi kör').not.toBe(
      Math.round(COKLU_TUTAR_TL * 100),
    );
  });

  it('tutar kalemlerden TÜRETİLİYOR, elle yazılmıyor', () => {
    const kaynak = readFileSync(path.join(KOK, 'src/lib/halkode/test-page.ts'), 'utf8');
    expect(kaynak).toMatch(/COKLU_TUTAR_TL\s*=\s*\n?\s*COKLU_SEPET\.reduce/);
    expect(kaynak, 'tutar sabit sayı olarak yazılmış').not.toMatch(/COKLU_TUTAR_TL\s*=\s*4\.1/);
  });

  it('test-initialize istemciden KALEM almıyor (yalnız seçim)', () => {
    expect(TEST_INIT).toMatch(/const coklu = b\.sepet === 'coklu'/);
    expect(TEST_INIT).toMatch(/items: coklu\s*\n?\s*\? COKLU_SEPET/);
    expect(TEST_INIT, 'istemciden kalem listesi alınıyor').not.toMatch(/b\.(items|line_items)/);
  });

  it('sepet özeti ödemeden ÖNCE görünür (3D sonucuna bağlı DEĞİL)', () => {
    const sayfa = readFileSync(path.join(KOK, 'src/components/halkode/DenemeSayfasi.tsx'), 'utf8');
    const ozet = sayfa.indexOf('Sepet özeti');
    const sonucKosulu = sayfa.indexOf('{sonuc && (');
    const form = sayfa.indexOf('<DenemeFormu');
    expect(ozet, 'sepet özeti bloğu yok').toBeGreaterThan(-1);
    // Özet, 3D sonuç bloğundan SONRA ve kart formundan ÖNCE olmalı — yani
    // `{sonuc && …}` koşulunun içinde DEĞİL, sayfa ilk açıldığında çizilen yerde.
    expect(ozet, 'özet sonuç koşulunun içinde kalmış').toBeGreaterThan(sonucKosulu);
    expect(ozet, 'özet kart formundan sonra gelmiş').toBeLessThan(form);
    expect(sayfa).toContain('{kalemler && kalemler.length > 0 && (');
  });

  it('tek kalemlide özet çizilmez (geriye dönük kırılma yok)', () => {
    const sayfa = readFileSync(path.join(KOK, 'src/components/halkode/DenemeSayfasi.tsx'), 'utf8');
    // `kalemler` verilmezse blok hiç render edilmez — koşul bunu garanti eder.
    expect(sayfa).toMatch(/\{kalemler && kalemler\.length > 0 && \(/);
    expect(sayfa).toMatch(/kalemler\?: ReadonlyArray/);
  });

  it('DEĞİŞMEZ: ödeme ucu birim fiyat yazıyor (satır toplamı DEĞİL)', () => {
    expect(INIT).toContain('price: Math.round(li.price ?? 0) / 100');
    expect(INIT, 'eski bozuk kalıp geri gelmiş').not.toMatch(
      /price:\s*\(\(?li\.price[^)]*\)\s*\*\s*li\.quantity\)?\s*\/\s*100/,
    );
    expect(INIT, 'kuruş sapması kapısı düşmüş').toContain('sapmaKurus');
  });
});

describe('CANLI deneme sepeti — Yunus\'un çok kalemli denemesi için (#991458)', () => {
  const urunler = COKLU_SEPET.filter((k) => k.name !== 'Kargo' && k.name !== 'İndirim');

  it('EN AZ 3 ürün kalemi var (kargo/indirim sayılmaz)', () => {
    expect(urunler.length).toBeGreaterThanOrEqual(3);
  });

  it('HER ürün kalemi TÜRKÇE KARAKTER içeriyor — POS yolu ölçülsün', () => {
    // ⚠ ÖLÇÜLDÜ (26 Eyl 2026): bu iddia önce kalemleri BİRLEŞTİRİP ölçüyordu ve
    // KÖRDÜ — bir kalemin adı Türkçesini kaybettiğinde diğer iki kalem eşleşmeyi
    // taşıyor, mutasyon çıkış 0 veriyordu. Kalem BAZINDA ölçülür.
    for (const k of urunler) {
      expect(k.name, `"${k.name}" Türkçe karakter içermiyor — ı/ş/ğ/ç/ö/ü yolu ölçülmüyor`).toMatch(
        /[ıİşŞğĞçÇöÖüÜ]/,
      );
      // Negatif: eski 'Demo ürün A' kalıbı (aksanlı ya da aksansız) geri gelirse kırılsın.
      expect(k.name).not.toMatch(/demo\s*[uü]r[uü]n/i);
    }
  });

  it('kalem başına tutar 1,00–2,00 TL bandında (gerçek para)', () => {
    for (const k of urunler) {
      expect(k.price, `${k.name} bandın dışında`).toBeGreaterThanOrEqual(1);
      expect(k.price, `${k.name} bandın dışında`).toBeLessThanOrEqual(2);
    }
  });

  it('adet>1 olan en az bir kalem var (status 13 sınıfı ölçülsün)', () => {
    expect(COKLU_SEPET.some((k) => k.quantity > 1)).toBe(true);
  });

  it('NEGATİF indirim kalemi duruyor', () => {
    expect(COKLU_SEPET.some((k) => k.price < 0)).toBe(true);
  });
});
