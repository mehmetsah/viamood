/**
 * ÇİVİ — takip numarası alanına BİZİM sipariş numaramız yazılmasın.
 *
 * ÖLÇÜLEN CANLI ARIZA (23 Eyl 2026, prod DB): 123 gönderinin 10'unda
 * `fulfillments.tracking_number` = "#1056", "#1101" … yani sipariş numarası.
 * Müşteri bu numarayla kargo takip edemiyor → "takip numaraları kayboldu".
 *
 * KÖK NEDEN — isim çakışması: `/shipment-create` İSTEĞİNDE `tracking_number`
 * bir REFERANS alanıdır (ShipmentCreateInput'ta "// referans" diye yazılı) ve
 * fulfillment-service oraya `order.orderName` koyuyor. Kurye barkodu
 * üretilemediğinde KargoLab bu değeri YANITTA aynen geri yansıtıyor.
 */
import { describe, expect, it } from 'vitest';
import { gercekTakipNo } from '@/lib/kargolab/takip-no';

const REFLER = ['#1056', '#1056', '#1056']; // tracking_number/order_number/waybill aynı değer

describe('gercekTakipNo — referans yansımasını eler', () => {
  it('bizim sipariş numaramız geri yansıdıysa takip no SAYILMAZ', () => {
    expect(gercekTakipNo('#1056', REFLER)).toBeNull();
  });

  it('gerçek kurye barkodu kabul edilir', () => {
    expect(gercekTakipNo('2784027344450', REFLER)).toBe('2784027344450');
    expect(gercekTakipNo('2754367560894', REFLER)).toBe('2754367560894');
  });

  it('rakam olmayan hiçbir değer takip no değildir', () => {
    for (const v of ['#1101', 'VIA-1056', 'abc', '#', '12-34']) {
      expect(gercekTakipNo(v, REFLER)).toBeNull();
    }
  });

  it('boş/None değerler null döner', () => {
    expect(gercekTakipNo('', REFLER)).toBeNull();
    expect(gercekTakipNo(null, REFLER)).toBeNull();
    expect(gercekTakipNo(undefined, REFLER)).toBeNull();
    expect(gercekTakipNo('   ', REFLER)).toBeNull();
  });

  it('referans SAYISAL olsa bile yansımaysa elenir (asıl tuzak)', () => {
    // Sipariş no "#" olmadan gönderilirse (orderNumber geri düşüşü) değer
    // rakamdan oluşur ve format kapısı YETMEZ — referans karşılaştırması şart.
    expect(gercekTakipNo('1056', ['1056', null, undefined])).toBeNull();
    // ⚠ ÖLÇÜLDÜ (26 Eyl 2026, Yunus · #990623): ÜSTTEKİ satır bu tuzağı ÖLÇMÜYOR —
    // '1056' dört hanedir, referans kapısı kaldırılsa bile `{6,}` format kapısı
    // onu zaten eliyor. Mutasyon kanıtı: `if (ref.has(v)) return null;` satırı
    // silindiğinde çivi 7/7 YEŞİL kalıyordu (çıkış 0), yani kapı korumasızdı.
    // Asıl arıza sınıfı BARKOD BİÇİMİNDE bir referanstır: fulfillment `waybill`
    // ya da `tracking_number` alanına 13 haneli bir değer koyduğunda format
    // kapısı geçer, yalnız referans karşılaştırması eler.
    expect(gercekTakipNo('2784027344450', ['2784027344450'])).toBeNull();
  });

  it('çok kısa rakam dizisi barkod sayılmaz', () => {
    expect(gercekTakipNo('123', [])).toBeNull();
    expect(gercekTakipNo('123456', [])).toBe('123456');
  });

  it('boşluklu gelen barkod kırpılır', () => {
    expect(gercekTakipNo('  2784027344450 ', REFLER)).toBe('2784027344450');
  });
});
