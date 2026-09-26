/**
 * Halköde kalem tutarı ÇİVİSİ — status_code=13 bir daha dönmesin.
 *
 * ÖLÇÜLMÜŞ ARIZA (25 Eyl 2026, canlı): 7 günde 10 başarısız / 4 başarılı ödeme.
 *   nginx access 25/Sep/2026:12:44:58 UTC · /api/v1/payment/halkode/callback
 *   status_code=13 "The total of your items price 8100.0000 is not equal to the
 *   invoice total (8100.0000)"
 * Sebep: kalem `price` alanına SATIR TOPLAMI yazılıp `quantity` de gönderiliyordu;
 * Halköde `price × quantity` hesapladığı için adet>1 sepette toplam şişiyordu.
 *
 * Bu çivi, hesabı ÜRÜN KAYNAĞINDAN okuyup çalıştırır (kopya mantık ölçmez —
 * kopya, kaynak değişince sessizce yeşil kalır). İddia tek ve serttir:
 *   Halköde'nin göreceği toplam  Σ round(price×100) × quantity  ===  totalKurus
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { kalemAdiKirp } from '../src/lib/halkode/kalem-adi';

const KAYNAK = readFileSync(
  path.resolve(__dirname, '../src/app/api/v1/payment/halkode/initialize/route.ts'),
  'utf8',
);

/** Çapanın tam 1 kez geçtiğini iddia ederek dilim alır. */
function tekIndex(s: string, capa: string): number {
  const i = s.indexOf(capa);
  expect(i, `çapa yok: ${capa}`).toBeGreaterThan(-1);
  expect(s.indexOf(capa, i + 1), `çapa birden çok: ${capa}`).toBe(-1);
  return i;
}

// Ürün kaynağındaki hesap bloğu: items kurulumundan kuruş kapısının sonuna.
const BAS = tekIndex(KAYNAK, '  const items: HalkodeItem[] = body.line_items.map(');
const SON = tekIndex(KAYNAK, "  await ensureTrCustomer(");
const BLOK = KAYNAK.slice(BAS, SON)
  .replace(': HalkodeItem[]', '') // tip notasyonu JS'te çalışmaz
  .replace(/console\.warn\([^)]*\);?/g, ''); // log gürültüsü testte istenmez

type Kalem = { variant_id: number; quantity: number; title?: string; price?: number };
type Cikti = { items: Array<{ name: string; price: number; quantity: number }>; duzeltildi: boolean };

/** Ürün kodunu gerçekten koşturur; girdiyi kuruş cinsinden alır. */
function hesapla(line_items: Kalem[], shipKurus: number, discKurus: number): Cikti {
  const itemsKurus = line_items.reduce((s, li) => s + Math.round(li.price ?? 0) * li.quantity, 0);
  const totalKurus = itemsKurus + shipKurus - discKurus;
  // ⚠ 26 Eyl 2026 (#991458): ürün kodu artık kalem adını `kalemAdiKirp` ile kırpıyor
  // (BAYT sınırlı kesme). Blok GERÇEK kaynaktan alındığı için bağımlılığı da
  // sandbox'a VERİLİR — sahte bir kopya yazmak çiviyi gerçek koddan koparırdı.
  const fn = new Function(
    'body',
    'shipKurus',
    'discKurus',
    'totalKurus',
    'kalemAdiKirp',
    `${BLOK}\nreturn { items, totalKurus };`,
  );
  const r = fn({ line_items }, shipKurus, discKurus, totalKurus, kalemAdiKirp) as {
    items: Cikti['items'];
    totalKurus: number;
  };
  return { items: r.items, duzeltildi: false };
}

/** Kuruş kapısına giren sapma — ürün kodundaki hesabın aynısı, kapı UYGULANMADAN önce. */
function sapmaOlc(line_items: Kalem[], shipKurus: number, discKurus: number): number {
  const total = beklenenTotal(line_items, shipKurus, discKurus);
  const ham = line_items.reduce((s, li) => s + Math.round(Math.round(li.price ?? 0) / 100 * 100) * li.quantity, 0)
    + (shipKurus > 0 ? shipKurus : 0) + (discKurus > 0 ? -discKurus : 0);
  return total - ham;
}

/** Halköde'nin kalemlerden göreceği toplam (price × quantity). */
const halkodeToplami = (items: Cikti['items']) =>
  items.reduce((s, it) => s + Math.round(it.price * 100) * it.quantity, 0);

const beklenenTotal = (l: Kalem[], ship: number, disc: number) =>
  l.reduce((s, li) => s + Math.round(li.price ?? 0) * li.quantity, 0) + ship - disc;

describe('Halköde kalem tutarı — items toplamı = fatura toplamı', () => {
  it('ARIZANIN KENDİSİ: adet>1 tek kalem (3 × 2700 TL) — eskiden status 13 dönüyordu', () => {
    const l: Kalem[] = [{ variant_id: 1, quantity: 3, price: 270000, title: 'Ürün' }];
    const { items } = hesapla(l, 0, 0);
    expect(items).toHaveLength(1);
    const [tek] = items;
    if (!tek) throw new Error('kalem üretilmedi');
    expect(tek.quantity).toBe(3);
    expect(tek.price, 'price BİRİM fiyat olmalı, satır toplamı değil').toBe(2700);
    expect(halkodeToplami(items)).toBe(beklenenTotal(l, 0, 0)); // 810000 kuruş
  });

  it('çok kalemli sepet, hepsi adet>1', () => {
    const l: Kalem[] = [
      { variant_id: 1, quantity: 3, price: 270000 },
      { variant_id: 2, quantity: 2, price: 45990 },
      { variant_id: 3, quantity: 5, price: 1999 },
    ];
    const { items } = hesapla(l, 0, 0);
    expect(halkodeToplami(items)).toBe(beklenenTotal(l, 0, 0));
  });

  it('PTT ücretsiz (kargo 0) — kargo kalemi hiç eklenmez, toplam bozulmaz', () => {
    const l: Kalem[] = [{ variant_id: 1, quantity: 3, price: 270000 }];
    const { items } = hesapla(l, 0, 0);
    expect(items.some((i) => i.name === 'Kargo')).toBe(false);
    expect(halkodeToplami(items)).toBe(beklenenTotal(l, 0, 0));
  });

  it('kargo + indirim birlikte', () => {
    const l: Kalem[] = [{ variant_id: 1, quantity: 2, price: 129990 }];
    const { items } = hesapla(l, 10200, 5000);
    expect(items.some((i) => i.name === 'Kargo')).toBe(true);
    expect(items.some((i) => i.name === 'İndirim')).toBe(true);
    expect(halkodeToplami(items)).toBe(beklenenTotal(l, 10200, 5000));
  });

  /**
   * ÖLÇÜLDÜ, iddia edilmedi: kuruş kapısı (`sapmaKurus !== 0`) bugünkü girdi uzayında
   * HİÇ tetiklenmiyor — mutasyon koşusunda kapı `if (false)` yapıldığında bu dosya
   * yeşil kaldı. Sebep matematiksel: total `Math.round(li.price) * qty` ile,
   * kalem `Math.round(li.price)/100` ile kuruluyor; Halköde'nin çarpımı
   * `round(price×100) × qty` aynı sayıyı verir. Kargo/indirim kalemleri de tam
   * kuruştan türer. Yani kapı SAVUNMA katmanıdır, kaldırılırsa bugün bir şey bozulmaz
   * ama `li.price` ondalıklı kuruş taşımaya başlarsa tek koruma odur.
   * Bu çivi kapının GEREKSİZ ÇALIŞMADIĞINI ölçer: sapma her zaman 0 olmalı.
   */
  it('kuruş sapması hiç doğmuyor — kapı savunma katmanı olarak boşta', () => {
    const senaryolar: Array<[Kalem[], number, number]> = [
      [[{ variant_id: 1, quantity: 3, price: 269999 }], 0, 0],
      [[{ variant_id: 1, quantity: 7, price: 14285 }], 0, 0],
      [[{ variant_id: 1, quantity: 3, price: 33333 }], 10200, 5000],
    ];
    for (const [l, ship, disc] of senaryolar) {
      expect(sapmaOlc(l, ship, disc), `sapma doğdu: ${JSON.stringify(l)}`).toBe(0);
    }
  });

  it('kaba tarama: 200 rastgele sepette sapma HİÇ oluşmuyor', () => {
    let kotu = 0;
    for (let n = 0; n < 200; n++) {
      const l: Kalem[] = Array.from({ length: 1 + (n % 4) }, (_, i) => ({
        variant_id: i + 1,
        quantity: 1 + ((n + i) % 6),
        price: 100 + ((n * 7919 + i * 104729) % 500000),
      }));
      const ship = n % 3 === 0 ? 0 : 10200;
      const disc = n % 5 === 0 ? 5000 : 0;
      const { items } = hesapla(l, ship, disc);
      if (halkodeToplami(items) !== beklenenTotal(l, ship, disc)) kotu++;
    }
    expect(kotu, `${kotu}/200 sepette items toplamı fatura toplamına eşit değil`).toBe(0);
  });

  it('DEĞİŞMEZ: price alanına satır toplamı yazan eski kalıp geri gelmesin', () => {
    expect(BLOK, 'eski kalıp geri gelmiş: price = (li.price * li.quantity) / 100').not.toMatch(
      /price:\s*\(\(?li\.price[^)]*\)\s*\*\s*li\.quantity\)?\s*\/\s*100/,
    );
    expect(BLOK).toContain('price: Math.round(li.price ?? 0) / 100');
  });
});
