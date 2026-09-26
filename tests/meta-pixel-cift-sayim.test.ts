/**
 * META PIXEL — ÇAKIŞMA VE ÇİFT SAYIM ÇİVİSİ (#990686, Elif · 25 Eyl 2026)
 *
 * Ölçülen durum: Shopify'ın kendi Web Pixel'i canlıda PageView · ViewContent ·
 * AddToCart olaylarını ZATEN gönderiyor (pixelIds ["1355197119331444"]).
 * Tamamlayıcı snippet bu üçünden birini basarsa olay İKİ KEZ sayılır ve
 * reklam raporu sessizce şişer — düzeltmesi zor, fark edilmesi daha da zor.
 *
 * Bu çivi tam olarak o sınıfı tutar: snippet yalnız Shopify'ın üretemediği
 * iki olayı (InitiateCheckout, Purchase) basmalı, başkasını basmamalı.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const snippet = readFileSync(
  join(process.cwd(), 'tema-yamalari/via-meta-pixel-tamamlayici.liquid'),
  'utf8',
);

/** Yorum bloklarını at — iddialar YALNIZ çalışan kodu ölçsün. */
const kod = snippet.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

describe('tamamlayıcı pixel snippet', () => {
  it('Shopify Web Pixel ile çakışan üç olayı BASMAZ', () => {
    for (const olay of ['PageView', 'ViewContent', 'AddToCart']) {
      expect(kod, `${olay} çift sayılır`).not.toContain(olay);
    }
  });

  it('ikinci bir fbq init etmez', () => {
    expect(kod).not.toContain("'init'");
    expect(kod).not.toContain('fbevents.js');
  });

  it('yalnız InitiateCheckout ve Purchase gönderir', () => {
    expect(kod).toContain("'InitiateCheckout'");
    expect(kod).toContain("'Purchase'");
    const gonderim = kod.match(/fbq\('track',/g) ?? [];
    expect(gonderim).toHaveLength(2);
  });

  it('value noktalı sayıdır — virgüllü metin üreten filtre kullanılmaz', () => {
    expect(kod).toContain('divided_by: 100.0');
    expect(kod).not.toContain('money_without_currency');
    expect(kod).not.toContain('money');
    // value tırnak içinde olmamalı: value: '…' biçimi Meta'da sessizce düşer
    expect(kod).not.toMatch(/value:\s*['"]/);
  });

  it('currency mağazadan türer, elle yazılmaz', () => {
    expect(kod).toContain("'{{ shop.currency }}'");
    expect(kod).not.toMatch(/currency:\s*'(TRY|USD|EUR)'/);
  });

  it('her iki olayda da çift sayım koruması vardır', () => {
    const korumalar = kod.match(/sessionStorage\.setItem/g) ?? [];
    expect(korumalar).toHaveLength(2);
  });

  it('fbq ASYNC yüklendiği için beklenir — erken çalışıp olayı kaçırmaz', () => {
    // Shopify Web Pixel'i fbevents.js'i sonradan indirir. Snippet ondan önce
    // çalışırsa `window.fbq` tanımsızdır; doğrudan `return` edilseydi olay
    // sessizce kaçardı ("gitti sanılır, gitmez"). Bu yüzden bekleyiş şart.
    expect(kod).toContain('window.vmFbqHazirOlunca');
    const kullanim = kod.match(/vmFbqHazirOlunca\(function \(fbq\)/g) ?? [];
    expect(kullanim).toHaveLength(2); // InitiateCheckout + Purchase
    // Bekleyiş sonsuz olmamalı: sayaçla vazgeçer.
    expect(kod).toMatch(/kalan\s*=\s*\d+/);
    expect(kod).toMatch(/if \(--kalan > 0\)/);
  });

  it('olaylar doğru sayfalara bağlanır — template contains DEĞİL page.handle', () => {
    // `template contains 'odeme'` odeme-sartlari gibi sayfalara da uyar ve
    // InitiateCheckout'u şişirir; sepet sayfası da ödeme başlangıcı değildir.
    expect(snippet).toContain("page.handle == 'odeme'");
    expect(snippet).toContain("page.handle == 'siparis-alindi'");
    expect(snippet).not.toContain("template contains 'cart'");
  });

  it('sıfır/negatif tutarda olay göndermez', () => {
    const guardlar = kod.match(/tutar <= 0\) return;/g) ?? [];
    expect(guardlar).toHaveLength(2);
  });
});
