/**
 * #991406 — InitiateCheckout + Purchase DAVRANIŞ çivisi.
 *
 * Desene bağlı, ada değil: sahte `fbq` ve sahte depo verilir, YAYILAN ÇAĞRILAR
 * sayılır. Kritik iddia MÜKERRER FREN'dir — Purchase iki kez yayılırsa Meta
 * ciroyu iki kat sayar.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { initiateCheckoutYay, purchaseAnahtari, purchaseYay, type Depo } from '@/lib/meta/pixel-yayim';
import { urunYuku, sepetYuku } from '@/lib/meta/pixel-olay';

let cagrilar: Array<[string, string, Record<string, unknown> | undefined]>;
const fbq = (k: string, o: string, y?: Record<string, unknown>) => { cagrilar.push([k, o, y]); };

function sahteDepo(): Depo & { kutu: Record<string, string> } {
  const kutu: Record<string, string> = {};
  return { kutu, getItem: (k) => (k in kutu ? kutu[k]! : null), setItem: (k, v) => { kutu[k] = v; } };
}

const YUK = urunYuku('51835342291076', 50000); // 500,00 TL

beforeEach(() => { cagrilar = []; });

describe('InitiateCheckout', () => {
  it('BİR KEZ doğar ve value/currency dolu gider', () => {
    const d = sahteDepo();
    expect(initiateCheckoutYay(fbq, YUK, d)).toBe(true);
    expect(cagrilar).toHaveLength(1);
    const [komut, olay, yuk] = cagrilar[0]!;
    expect(komut).toBe('track');
    expect(olay).toBe('InitiateCheckout');
    expect(yuk!.value).toBe(500);
    expect(yuk!.currency).toBe('TRY');
    expect(yuk!.content_ids).toEqual(['51835342291076']);
  });

  it('NEGATİF: aynı oturumda İKİNCİ kez yayılmaz', () => {
    const d = sahteDepo();
    initiateCheckoutYay(fbq, YUK, d);
    expect(initiateCheckoutYay(fbq, YUK, d)).toBe(false);
    expect(cagrilar, 'huni sayısı şişer').toHaveLength(1);
  });

  it('NEGATİF: değersiz yük (value=0) yayılmaz', () => {
    expect(initiateCheckoutYay(fbq, urunYuku('v1', 0), sahteDepo())).toBe(false);
    expect(cagrilar).toHaveLength(0);
  });

  it('NEGATİF: fbq yoksa sessizce vazgeçer, patlamaz', () => {
    expect(initiateCheckoutYay(undefined, YUK, sahteDepo())).toBe(false);
    expect(initiateCheckoutYay(null, YUK, sahteDepo())).toBe(false);
  });
});

describe('Purchase — sipariş no ile TEK KEZ', () => {
  it('sipariş no ile bir kez doğar, order_id taşır', () => {
    const d = sahteDepo();
    expect(purchaseYay(fbq, YUK, 'VM1041', d)).toBe(true);
    expect(cagrilar).toHaveLength(1);
    const [, olay, yuk] = cagrilar[0]!;
    expect(olay).toBe('Purchase');
    expect(yuk!.order_id).toBe('VM1041');
    expect(yuk!.value).toBe(500);
    expect(yuk!.currency).toBe('TRY');
  });

  it('🔴 NEGATİF: AYNI sipariş no ikinci kez YAYILMAZ (çift ciro kapısı)', () => {
    const d = sahteDepo();
    purchaseYay(fbq, YUK, 'VM1041', d);
    expect(purchaseYay(fbq, YUK, 'VM1041', d)).toBe(false);
    expect(purchaseYay(fbq, YUK, 'VM1041', d)).toBe(false);
    expect(cagrilar, 'Meta ciroyu iki kat sayar').toHaveLength(1);
  });

  it('damga sipariş NO bazlı: FARKLI sipariş yayılır', () => {
    const d = sahteDepo();
    purchaseYay(fbq, YUK, 'VM1041', d);
    expect(purchaseYay(fbq, YUK, 'VM1042', d)).toBe(true);
    expect(cagrilar).toHaveLength(2);
  });

  it('damga YENİ depoda da tutar (sekme değişse bile) — anahtar sipariş nosundan türer', () => {
    expect(purchaseAnahtari('VM1041')).toBe('via_fb_purchase_VM1041');
    expect(purchaseAnahtari(' VM1041 ')).toBe('via_fb_purchase_VM1041');
    expect(purchaseAnahtari(1041)).toBe(purchaseAnahtari('1041'));
  });

  it('NEGATİF: sipariş no YOKSA/boşsa yayılmaz — damgasız Purchase tekrar riski', () => {
    const d = sahteDepo();
    expect(purchaseYay(fbq, YUK, null, d)).toBe(false);
    expect(purchaseYay(fbq, YUK, undefined, d)).toBe(false);
    expect(purchaseYay(fbq, YUK, '   ', d)).toBe(false);
    expect(cagrilar).toHaveLength(0);
  });

  it('NEGATİF: değersiz yük yayılmaz (value<=0 / currency yanlış)', () => {
    const d = sahteDepo();
    expect(purchaseYay(fbq, urunYuku('v1', 0), 'VM1', d)).toBe(false);
    expect(purchaseYay(fbq, { ...YUK, currency: 'USD' }, 'VM1', d)).toBe(false);
    expect(cagrilar).toHaveLength(0);
  });

  it('çok kalemli sepette value ÖDENEN toplam, item_price BİRİM fiyat', () => {
    const d = sahteDepo();
    const yuk = sepetYuku(
      [{ variant_id: 'a', quantity: 2, line_price_cents: 1000 }, { variant_id: 'b', quantity: 1, line_price_cents: 300 }],
      1500, // kargo dâhil ödenen
    );
    expect(purchaseYay(fbq, yuk, 'VM9', d)).toBe(true);
    const y = cagrilar[0]![2]!;
    expect(y.value).toBe(15);
    expect((y.contents as Array<{ item_price: number }>)[0]!.item_price).toBe(5);
  });

  it('depo YOKSA (gizli mod) olay YİNE gider — ölçüm kaybı satış kaybından iyidir', () => {
    expect(purchaseYay(fbq, YUK, 'VM77', null)).toBe(true);
    expect(cagrilar).toHaveLength(1);
  });
});
