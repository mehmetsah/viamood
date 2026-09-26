/**
 * ÇİVİ — kuruş sapma kapısı (Okan'ın 26 Eyl denetiminde MUT-E olarak devrettiği madde).
 *
 * SORUN: kapı `initialize/route.ts` içinde gömülüydü ve BEKÇİSİZDİ. Okan'ın
 * `sapmaKurus = 0` mutasyonu hiçbir iddiayı kırmadı. Sebep ölçüldü ve matematiksel:
 * ürün kodu yolunda `itemsKurus` ve `itemsToplamKurus` AYNI yuvarlamadan geçiyor
 * (`Math.round(li.price)`), bu yüzden sapma DOĞAMIYOR — altı senaryo denendi
 * (269999 / 14285 / 33333 / 33333.333… / 0.5 / 11111.111 kuruş), sapma doğan
 * senaryo sayısı **0**. Yani "sapmalı girdi bul" yolu kapalıydı.
 *
 * ÇÖZÜM: kapıyı zayıflatmak değil, ÖLÇÜLEBİLİR kılmak. Mantık saf bir fonksiyona
 * çıkarıldı (`src/lib/halkode/kalem-hizala.ts`) ve doğrudan SAPMALI `items`
 * verilerek sınanıyor. Kapının çalıştığı `duzeltildi` alanıyla gözlenir — log'a
 * bağlı değil.
 *
 * Neden korunuyor: kalem toplamı fatura toplamına eşit değilse Halköde
 * `status_code=13` döndürür ve ödeme REDDEDİLİR (25 Eyl'de 10 kez).
 */
import { describe, it, expect } from 'vitest';
import { kalemleriHizala, kalemToplamiKurus } from '../src/lib/halkode/kalem-hizala';

const K = (name: string, price: number, quantity = 1) => ({ name, price, quantity });

describe('sapma kapısı GERÇEKTEN tetikleniyor (doğrudan sapmalı girdiyle)', () => {
  it('1 kuruş eksik kalem toplamı → kapı çalışır ve toplamı OTURTUR', () => {
    const items = [K('Ürün', 3.33, 3)]; // 999 kuruş
    const s = kalemleriHizala(items, 1000); // fatura 1000 kuruş
    expect(s.sapmaKurus).toBe(1);
    expect(s.duzeltildi, 'kapı tetiklenmedi').toBe(true);
    expect(kalemToplamiKurus(s.items), 'toplam faturaya oturmadı').toBe(1000);
  });

  it('1 kuruş FAZLA kalem toplamı → kapı negatif sapmayı da kapatır', () => {
    const items = [K('Ürün', 3.34, 3)]; // 1002 kuruş
    const s = kalemleriHizala(items, 1001);
    expect(s.sapmaKurus).toBe(-1);
    expect(s.duzeltildi).toBe(true);
    expect(kalemToplamiKurus(s.items)).toBe(1001);
  });

  it('çok kalemli sepette sapma SON kaleme yazılır', () => {
    const items = [K('A', 1.25, 2), K('B', 1.1), K('Kargo', 0.5), K('İndirim', -1)];
    // gerçek toplam: 250 + 110 + 50 − 100 = 310 kuruş. Fatura 312 → 2 kuruş sapma.
    const s = kalemleriHizala(items, 312);
    expect(s.sapmaKurus).toBe(2);
    expect(s.duzeltildi).toBe(true);
    expect(kalemToplamiKurus(s.items)).toBe(312);
    // İlk üç kalem DOKUNULMAMIŞ olmalı — müşterinin gördüğü satırlar oynamaz.
    expect(s.items[0].price).toBe(1.25);
    expect(s.items[1].price).toBe(1.1);
    expect(s.items[2].price).toBe(0.5);
    // Son kalem İndirim (adet 1) → sapma ona yazılır, yeni satır açılmaz.
    expect(s.items).toHaveLength(4);
    expect(s.items[3].price).not.toBe(-1);
  });

  it('adet>1 son kalemde sapma ADETE bölünerek yazılır', () => {
    const items = [K('Ürün', 5, 2)]; // 1000 kuruş
    const s = kalemleriHizala(items, 1004); // 4 kuruş sapma, adet 2 → birim +2
    expect(s.duzeltildi).toBe(true);
    expect(s.items[0].price).toBe(5.02);
    expect(kalemToplamiKurus(s.items)).toBe(1004);
  });

  it('sapma YOKSA kapı BOŞTA kalır — gereksiz dokunma yok', () => {
    const items = [K('A', 1.25, 2), K('B', 1.6)];
    const s = kalemleriHizala(items, 410); // 250 + 160 = 410, sapma yok
    expect(s.sapmaKurus).toBe(0);
    expect(s.duzeltildi, 'kapı gereksiz çalıştı').toBe(false);
    expect(s.items).toEqual(items);
  });

  it('girdi dizisi DEĞİŞTİRİLMEZ (yan etki yok)', () => {
    const items = [K('A', 3.33, 3)];
    const kopya = JSON.parse(JSON.stringify(items));
    kalemleriHizala(items, 1000);
    expect(items).toEqual(kopya);
  });

  it('boş sepet / adet 0 → çökmez, toplamı düzeltme kalemiyle OTURTUR', () => {
    // Ürün kodunda boş `line_items` 400 ile geri çevriliyor, yani buraya gelmez;
    // yine de davranış TANIMLI olmalı: sapma bir yere yazılmadan Halköde 13 döner.
    const bos = kalemleriHizala([], 100);
    expect(bos.duzeltildi).toBe(true);
    expect(kalemToplamiKurus(bos.items)).toBe(100);
    const adetSifir = kalemleriHizala([K('X', 1, 0)], 100);
    expect(adetSifir.duzeltildi).toBe(true);
    expect(kalemToplamiKurus(adetSifir.items)).toBe(100);
  });

  it('adete BÖLÜNMEYEN sapma ayrı kalemle kapanır — satır fiyatları oynamaz', () => {
    // ÖLÇÜLEN KUSURUN kendisi: 3,33 × 3 = 999, fatura 1000 → sapma 1, adet 3.
    // Eski hâl 1/3'ü yuvarlayıp fiyatı HİÇ değiştirmiyordu ve toplam 999'da kalıyordu.
    const s = kalemleriHizala([K('Ürün', 3.33, 3)], 1000);
    expect(s.duzeltildi).toBe(true);
    expect(s.items[0].price, 'müşterinin gördüğü birim fiyat oynadı').toBe(3.33);
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toEqual({ name: 'Kuruş düzeltme', price: 0.01, quantity: 1 });
    expect(kalemToplamiKurus(s.items)).toBe(1000);
  });

  it('kalemToplamiKurus Halköde gibi price × quantity hesaplar', () => {
    expect(kalemToplamiKurus([K('A', 1.25, 2), K('B', 1.1), K('İndirim', -1)])).toBe(250 + 110 - 100);
  });
});
