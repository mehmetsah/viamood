/**
 * ÇİVİ — Meta Pixel'e giden value/currency BİÇİMİ.
 *
 * ÖLÇÜLEN ARIZA (Yunus, 25 Eyl): value `money_without_currency` ile
 * üretilince mağazanın yerel biçimi uygulanıyor ve bu mağazada
 * money_format = {{amount_with_comma_separator}}TL → "400,00" çıkıyor.
 * Virgüllü METİN; Meta olayı sessizce düşürüyor. currency de 'USD' yazılmıştı.
 *
 * Bu test snippet'in KODUNU denetler (yorumları değil): yasaklı kalıp koda
 * girerse kırılır. Yorumda geçmesi serbest — arızanın gerekçesi orada yazılı.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const YOL = join(__dirname, '..', 'tema-yamalari', 'via-meta-pixel.liquid.YENI');
const ham = () => readFileSync(YOL, 'utf8');

/** Liquid yorum bloklarını ({%- comment -%} … {%- endcomment -%}) atar. */
function kod(): string {
  return ham().replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
}

describe('Meta Pixel değer biçimi', () => {
  it('KODDA money_without_currency KULLANILMAZ (virgüllü metin üretir)', () => {
    expect(kod()).not.toContain('money_without_currency');
  });

  it('KODDA sabit USD yazılmaz — currency mağazadan türetilir', () => {
    expect(kod()).not.toMatch(/currency:\s*'USD'/);
    expect(kod()).toContain("currency: '{{ shop.currency }}'");
  });

  it('Liquid value alanları divided_by: 100.0 ile noktalı sayı üretir', () => {
    const k = kod();
    const valueSatirlari = k.match(/value:\s*\{\{[^}]*\}\}/g) ?? [];
    expect(valueSatirlari.length).toBeGreaterThan(0);
    for (const s of valueSatirlari) expect(s).toContain('divided_by: 100.0');
  });

  it('value TIRNAK İÇİNDE gönderilmez (metin olursa Meta düşürür)', () => {
    expect(kod()).not.toMatch(/value:\s*['"]/);
  });

  it('Shopify Web Pixel ZATEN gönderdiği olaylar KODDA tekrarlanmaz (çift sayım)', () => {
    // 25 Eyl canlı ölçümü: PageView / ViewContent / AddToCart üçü de
    // www.facebook.com/tr POST ile id=1355197119331444 üzerinden gidiyor.
    // Snippet bunları tekrar gönderirse Meta sayıları ikiye katlanır.
    const k = kod();
    expect(k).not.toContain("'PageView'");
    expect(k).not.toContain("'ViewContent'");
    expect(k).not.toContain("'AddToCart'");
  });

  it('KODDA fbq init YAPILMAZ (piksel zaten init edilmiş, ikinci init PageView tekrarlar)', () => {
    expect(kod()).not.toMatch(/fbq\(\s*'init'/);
  });

  it('YALNIZ gerçekten eksik iki olay gönderilir', () => {
    const k = kod();
    expect(k).toContain("'InitiateCheckout'");
    expect(k).toContain("'Purchase'");
  });

  it('Olaylar doğru sayfalara bağlanır (page.handle — template contains değil)', () => {
    const h = ham();
    expect(h).toContain("page.handle == 'odeme'");
    expect(h).toContain("page.handle == 'siparis-alindi'");
  });

  it('fbq hazır değilse olay atlanır, hata fırlatılmaz', () => {
    expect(kod()).toContain('fbqHazirOlunca');
  });

  it('Purchase çift sayıma karşı korunur (sayfa yenilemesi)', () => {
    const k = kod();
    expect(k).toContain('vm_fbq_purchase_');
    expect(k).toContain('sessionStorage');
  });

  it('Purchase tutarı Number() ile sayıya çevrilir', () => {
    expect(kod()).toMatch(/Number\(q\.get\('total'\)\)/);
  });
});
