/**
 * META PIXEL DEĞER ÇİVİSİ — value/currency düşerse bu dosya KIRILIR.
 *
 * ÖLÇÜLEN ARIZA (26 Eyl 2026, Elif): viamood.com.tr'de InitiateCheckout ve
 * Purchase hiç doğmuyordu (tema içi /pages/odeme, Shopify checkout'u değil) →
 * Meta'ya dönüşüm değeri ulaşmıyordu. ViewContent/AddToCart'ta value vardı ama
 * `contents` yoktu, yani çok kalemli sepette kalem bazlı fiyat gitmiyordu.
 */
import { describe, it, expect } from 'vitest';
import { sepetYuku, urunYuku, gonderilebilir, tlye, PARA_BIRIMI } from '../src/lib/meta/pixel-olay';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Meta olay yükü — değer ve para birimi', () => {
  it('tek ürün: value + currency + content_ids + contents birlikte gider', () => {
    const y = urunYuku(51835342291076, 50000);
    expect(y.value).toBe(500);
    expect(y.currency).toBe('TRY');
    expect(y.content_ids).toEqual(['51835342291076']);
    expect(y.contents).toEqual([{ id: '51835342291076', quantity: 1, item_price: 500 }]);
  });

  it('currency SABİT TRY — başka değer üretilemez', () => {
    expect(PARA_BIRIMI).toBe('TRY');
    expect(sepetYuku([{ variant_id: 'v1', quantity: 1, line_price_cents: 100 }], 100).currency).toBe('TRY');
  });

  it('contents item_price BİRİM fiyattır, satır toplamı DEĞİL', () => {
    // 3 adet × 34,90 = 104,70 satır toplamı. item_price 34.90 olmalı, 104.70 OLMAMALI.
    const y = sepetYuku([{ variant_id: 'v1', quantity: 3, line_price_cents: 10470 }], 10470);
    expect(y.contents[0].item_price).toBe(34.9);
    expect(y.contents[0].item_price, 'satır toplamı birim fiyat sanılıyor').not.toBe(104.7);
  });

  it('ÇOK KALEMLİ: kalem toplamı ile value tutuyor (sapma 0)', () => {
    const kalemler = [
      { variant_id: 'a', quantity: 2, line_price_cents: 698 },
      { variant_id: 'b', quantity: 1, line_price_cents: 275 },
    ];
    const y = sepetYuku(kalemler, 698 + 275);
    expect(y.value).toBe(9.73);
    expect(y.sapma_kurus, 'kalem toplamı ile value ayrışmış (Halköde 13 sınıfı)').toBe(0);
    expect(y.contents).toHaveLength(2);
    expect(y.content_ids).toEqual(['a', 'b']);
  });

  it('value ÖDENECEK tutardır: kargo dâhil, sapma açıkça taşınır', () => {
    // kalemler 973 kuruş, kargo 150 kuruş → ödenecek 1123.
    const y = sepetYuku([
      { variant_id: 'a', quantity: 2, line_price_cents: 698 },
      { variant_id: 'b', quantity: 1, line_price_cents: 275 },
    ], 1123);
    expect(y.value).toBe(11.23);
    // Kargo contents'e girmez; fark SESSİZ kalmaz, ölçülebilir alanda durur.
    expect(y.sapma_kurus).toBe(150);
  });

  it('kuruş bölünmesi sessizce yutulmaz', () => {
    // 3 adet, satır toplamı 1000 kuruş → birim 333 kuruş, 3×333=999, 1 kuruş sapma.
    const y = sepetYuku([{ variant_id: 'a', quantity: 3, line_price_cents: 1000 }], 1000);
    expect(y.contents[0].item_price).toBe(3.33);
    expect(y.sapma_kurus).toBe(1);
  });

  it('tlye kuruşu TL yapar, kayan nokta birikmez', () => {
    expect(tlye(50000)).toBe(500);
    expect(tlye(1123)).toBe(11.23);
    expect(tlye(1)).toBe(0.01);
  });
});

describe('GÖNDERİM KAPISI — değersiz olay Meta\'ya gitmez (negatif iddialar)', () => {
  const saglam = urunYuku('v1', 50000);

  it('sağlam yük gönderilebilir', () => {
    expect(gonderilebilir(saglam)).toBe(true);
  });

  it('value DÜŞERSE gönderilmez', () => {
    const { value: _y, ...eksik } = saglam;
    expect(gonderilebilir(eksik as never), 'value olmadan olay gidiyor').toBe(false);
  });

  it('value 0 ya da undefined ise gönderilmez', () => {
    expect(gonderilebilir({ ...saglam, value: 0 })).toBe(false);
    expect(gonderilebilir({ ...saglam, value: undefined })).toBe(false);
    expect(gonderilebilir({ ...saglam, value: NaN })).toBe(false);
    expect(gonderilebilir({ ...saglam, value: -5 })).toBe(false);
  });

  it('currency DÜŞERSE ya da TRY değilse gönderilmez', () => {
    const { currency: _c, ...eksik } = saglam;
    expect(gonderilebilir(eksik as never), 'currency olmadan olay gidiyor').toBe(false);
    expect(gonderilebilir({ ...saglam, currency: 'USD' })).toBe(false);
    expect(gonderilebilir({ ...saglam, currency: '' })).toBe(false);
  });

  it('content_ids boşsa gönderilmez', () => {
    expect(gonderilebilir({ ...saglam, content_ids: [] })).toBe(false);
  });

  it('null/undefined yük gönderilmez', () => {
    expect(gonderilebilir(null)).toBe(false);
    expect(gonderilebilir(undefined)).toBe(false);
  });
});

describe('Shopify tema yaması — saf katmanla aynı kuralı yazıyor mu', () => {
  const YAMA = readFileSync(
    path.join(__dirname, '..', 'tema-yamalari/via-checkout.liquid.meta-initiate-purchase'),
    'utf8',
  );

  it("currency 'TRY' sabit yazılmış", () => {
    expect(YAMA).toMatch(/currency:\s*'TRY'/);
  });

  it('item_price BİRİM fiyat (satır toplamı adede bölünüyor)', () => {
    expect(YAMA).toMatch(/item_price:\s*Math\.round\(i\.line_price \/ i\.quantity\)\s*\/\s*100/);
    // line_price'ı doğrudan item_price yapan hâl geri gelirse kırılsın.
    expect(YAMA, 'satır toplamı birim fiyat olarak yazılmış').not.toMatch(
      /item_price:\s*i\.line_price\s*\/\s*100/,
    );
  });

  it('değersiz olay göndermeme kapısı yamada da var', () => {
    expect(YAMA).toMatch(/value <= 0\) return null/);
  });

  it('Purchase çift sayım kapısı var', () => {
    expect(YAMA).toMatch(/sessionStorage\.getItem\(anahtar\)/);
  });

  it('yama CANLI TEMAYA UYGULANMADI diye işaretli (erişim Mehmet Şah/Yunus kararı)', () => {
    expect(YAMA).toMatch(/UYGULANMADI/);
  });
});
