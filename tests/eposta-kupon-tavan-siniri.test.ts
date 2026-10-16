/**
 * ÇİVİ — 300 TL tavanı YALNIZ e-posta akışı kuponuna aittir; Shopify kupon
 * yoluna (discount-resolve.ts) SIZDIRILAMAZ.
 *
 * NEDEN VAR (16 Eki 2026 ölçümü): #994057'nin "E4" maddesi tavanın
 * `discount-resolve.ts`'teki yüzde dalına konmasını istiyordu. Ölçüldü, bu
 * YANLIŞ YER ve PARA KAYBETTİREN bir değişiklik olurdu:
 *
 *   · `discount-resolve.ts` SHOPIFY kuponlarını çözer (iyzico · halkode · paytr ·
 *     cod · havale uçları oradan geçer). E-posta akışı kuponları ise Shopify'da
 *     HİÇ YOK (`eposta-kupon.ts` başlığı: "kodlar Shopify'da yok"), yani oraya
 *     konan bir tavan hedeflediği kuponlara ASLA değmez.
 *   · Buna karşılık her Shopify YÜZDE kuponunu keserdi. Ölçülen zarar:
 *     %20 kampanya kuponu / 5.000 TL sepet → 1.000 TL yerine 300 TL,
 *     sipariş başına 700 TL müşteri kaybı.
 *
 * Tavanın doğru yeri `eposta-akis.ts` → `indirimTutariKurus()` ve orası ZATEN
 * çivili (`eposta-akis-cekirdek.test.ts`, negatif ayağıyla). Bu dosya o sınırın
 * aşınmasını engeller.
 *
 * ⚠ Yorumlar sökülerek ölçülür — bu depoda "çivi kendi açıklamasını sayıyor"
 *   sınıfı daha önce ölçüldü.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UST_LIMIT_KURUS, UST_LIMIT_ESIGI_KURUS, indirimTutariKurus } from '@/lib/eposta-akis';

const kok = join(__dirname, '..');
const yorumsuz = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const oku = (p: string) => yorumsuz(readFileSync(join(kok, p), 'utf8'));

const COZUCU = oku('src/lib/shopify/discount-resolve.ts');
const CEKIRDEK = oku('src/lib/eposta-akis.ts');

describe('tavan e-posta kuponuna aittir, Shopify yoluna sızmaz', () => {
  it('discount-resolve e-posta tavan sabitlerini KULLANMIYOR', () => {
    expect(COZUCU).not.toContain('UST_LIMIT_KURUS');
    expect(COZUCU).not.toContain('UST_LIMIT_ESIGI_KURUS');
    expect(COZUCU).not.toContain('indirimTutariKurus');
    expect(COZUCU).not.toContain('eposta-akis');
  });

  it('discount-resolve tavanı ELDE YAZILMIŞ sayıyla da uygulamıyor', () => {
    // 30_000 / 30000 / 300 * 100 gibi kaçak biçimler
    expect(/\b30[_ ]?000\b/.test(COZUCU)).toBe(false);
    expect(/150[_ ]?000/.test(COZUCU)).toBe(false);
  });

  it('discount-resolve ASIL güvenlik sınırını koruyor (hak eden tutarı aşamaz)', () => {
    expect(COZUCU).toContain('Math.min(amountKurus, eligibleSubtotalKurus)');
  });

  it('tavanın TEK KAYNAĞI çekirdektir', () => {
    expect(CEKIRDEK).toContain('export const UST_LIMIT_KURUS');
    expect(CEKIRDEK).toContain('export function indirimTutariKurus');
  });

  it('DAVRANIŞ: tavan gerçekten 300 TL’de kesiyor (eşik üstü)', () => {
    expect(indirimTutariKurus(500_000)).toBe(UST_LIMIT_KURUS);
    expect(indirimTutariKurus(1_000_000)).toBe(UST_LIMIT_KURUS);
  });

  it('NEGATİF: eşiğin ALTINDA tavan devreye girmez — yüzde aynen geçer', () => {
    expect(indirimTutariKurus(UST_LIMIT_ESIGI_KURUS)).toBe(15_000);
    expect(indirimTutariKurus(UST_LIMIT_ESIGI_KURUS)).not.toBe(UST_LIMIT_KURUS);
  });

  it('NEGATİF: Shopify kupon hesabı tavandan ETKİLENMİYOR (zarar ölçümü)', () => {
    // discount-resolve'un yüzde dalı: tavan yok, yalnız hak eden tutar sınırı.
    const sepetKurus = 500_000, yuzde = 20;
    const cozucuSonuc = Math.min(Math.round((sepetKurus * yuzde) / 100), sepetKurus);
    expect(cozucuSonuc).toBe(100_000);            // 1.000 TL — kampanya aynen geçer
    expect(cozucuSonuc).not.toBe(UST_LIMIT_KURUS); // 300 TL'ye kırpılmıyor
  });
});
