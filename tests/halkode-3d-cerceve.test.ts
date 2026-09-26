/**
 * Halköde 3D SİTE İÇİ ÇERÇEVE çivisi.
 *
 * Karar (Yunus, Viamood, 25 Eyl 2026): "Paytr gibi direk site içerisinde iframe
 * gözükecekse yapalım, ayrı linke yönlendirmek doğru olmaz."
 * Önceki davranış `document.write(form_html)` idi — tüm sayfayı eziyordu.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const oku = (p: string) => readFileSync(path.join(KOK, p), 'utf8');
const CERCEVE = oku('src/components/halkode/Halkode3DCerceve.tsx');
const CHECKOUT = oku('src/app/(storefront)/odeme/CheckoutForm.tsx');
const DENEME = oku('src/components/halkode/DenemeFormu.tsx');
const CALLBACK = oku('src/app/api/v1/payment/halkode/callback/route.ts');
const RAPOR = oku('src/app/api/v1/payment/halkode/cerceve-raporu/route.ts');

/** Yorumlar ölçüm dışı: yasağı ANLATAN yorum ihlal sayılmasın. */
const kodu = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

describe('3D artık site içi çerçevede', () => {
  it('iki tüketici de document.write ile sayfayı EZMİYOR', () => {
    for (const [ad, k] of [['CheckoutForm', CHECKOUT], ['DenemeFormu', DENEME]] as const) {
      expect(kodu(k), `${ad} hâlâ belgeyi eziyor`).not.toMatch(/document\.open\(\)/);
      expect(kodu(k), `${ad} hâlâ document.write kullanıyor`).not.toMatch(/document\.write\(/);
    }
  });

  it('iki tüketici de çerçeve bileşenini kullanıyor', () => {
    for (const k of [CHECKOUT, DENEME]) {
      expect(k).toContain('Halkode3DCerceve');
      expect(k).toMatch(/setUc3d\(/);
    }
  });

  it('çerçeve srcDoc + sandbox ile kuruluyor, üst pencere gezinimi açık', () => {
    expect(CERCEVE).toContain('srcDoc={formHtml}');
    for (const izin of ['allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-top-navigation']) {
      expect(CERCEVE, `sandbox izni eksik: ${izin}`).toContain(izin);
    }
    expect(CERCEVE, 'min yükseklik 560px değil').toContain('h-[560px]');
    expect(CERCEVE, 'tam genişlik yok').toMatch(/w-full/);
  });

  it('EMNİYET SUBABI: zaman aşımı + boş içerik → tam sayfaya düşüş', () => {
    expect(CERCEVE).toMatch(/ZAMAN_ASIMI_MS\s*=\s*8000/);
    expect(CERCEVE).toContain('tamSayfayaDus');
    // düşüş yolu GERÇEKTEN eski davranışı çağırıyor
    expect(CERCEVE).toMatch(/function tamSayfayaDus[\s\S]*?document\.write\(formHtml\)/);
    // iki tetikleyici de var
    expect(CERCEVE).toContain("izBirak('zaman_asimi')");
    expect(CERCEVE).toContain("izBirak('bos_icerik')");
  });

  it('düşüş sunucuya iz bırakıyor ve iz ucu KART VERİSİ kabul etmiyor', () => {
    expect(CERCEVE).toContain('/api/v1/payment/halkode/cerceve-raporu');
    // uç yalnız sabit alanları okur
    expect(RAPOR).toContain('SEBEPLER');
    expect(RAPOR).toContain('KAYNAKLAR');
    expect(kodu(RAPOR)).not.toMatch(/cc_no|cvv|expiry|card|kart_no/i);
  });

  it('callback çerçeveden ÇIKARIYOR — üç ayak da var', () => {
    expect(CALLBACK, 'üst pencere yönlendirmesi yok').toContain('window.top.location.replace');
    expect(CALLBACK, 'postMessage yok').toContain('vmHalkode:"sonuc"');
    expect(CALLBACK, 'script çalışmazsa çıkış yok').toContain('meta http-equiv="refresh"');
    expect(CALLBACK, 'görünür bağlantı yok').toContain('target="_top"');
  });

  it('çerçeve bileşeni postMessage sonucunu dinliyor', () => {
    expect(CERCEVE).toMatch(/addEventListener\('message'/);
    expect(CERCEVE).toContain("vmHalkode !== 'sonuc'");
  });

  it('NEGATİF: kart alanı çerçeveye ya da iz ucuna sızmıyor', () => {
    for (const [ad, k] of [['Halkode3DCerceve', CERCEVE], ['cerceve-raporu', RAPOR]] as const) {
      expect(kodu(k), `${ad} kart alanı taşıyor`).not.toMatch(/\b(cc_no|cvv|expiry_month|expiry_year|cardNumber)\b/);
    }
  });

  /**
   * PayTR CANLI yoldur ve bu iş ona dokunmamalıydı. Metin araması yanlış ölçer
   * (dosyada zaten PayTR dalı var); doğru ölçüm SAYININ değişmemesidir.
   * origin/main'deki geçiş sayısı 6 (ölçüldü); bu commit onu değiştirmiyor.
   */
  it('PayTR yoluna dokunulmadı — geçiş sayısı değişmedi', () => {
    const say = (s: string) => (s.match(/paytr/gi) ?? []).length;
    expect(say(CHECKOUT), 'CheckoutForm PayTR geçiş sayısı değişmiş').toBe(6);
  });
});
