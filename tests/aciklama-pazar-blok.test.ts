/**
 * #994831 · ADIM 1 · PAZAR YERİ İÇ BLOKLARI ÇİVİSİ.
 * MUTASYON: SEO listesi kapısı, Trendyol ad kapısı, madde kapısı, blok dışı paragraf kapısı, çift blok kapısı
 * ya da metin kapısı kaldırılırsa ilgili iddialar KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { adGovdesiMi, blokCalistir, karar, kuyrukSoy, seoListesiMi, type KutukSatiri } from '../src/lib/aciklama-pazar-blok';

// Canlı biçim (31 Eki 2026, pola-bambu-kiz-cocuk-soket-corap-tavsan-desenli-6li-set, kısaltıldı)
const BASLIK = "Pola Bambu Kız Çocuk Soket Çorap Tavşan Desenli 6'lı SET";
const GOVDE = '<p>Pola Concept Bambu Kız Çocuk Soket Çorap, renkli tavşan desenleriyle günlük kullanım için tasarlanmış 6 çiftlik asorti settir.</p>'
  + '<p>Öne Çıkanlar</p><p>- %80 bambu, %18 poliamid ve %2 elastan içerik</p><p>- Dikişsiz burun</p>'
  + '<p>Teknik Bilgiler</p><p>Özellik Bilgi</p><p>Marka Pola Concept</p><p>Paket Adedi 6 Çift</p>'
  + '<p>Bakım Talimatları</p><p>- 30°C’de yıkayınız.</p><p>Kategori Meta Alanları</p><p>Yıkama Sıcaklığı: 30°C</p>';
const SEO = '<p>Ürün Etiketleri (SEO)</p><p>pola concept kız çocuk çorap, pola bambu kız çocuk çorap, pola tavşan desenli çorap</p>';
const AD = "<p>Trendyol Ürün Adı</p><p>Pola Concept Bambu Kız Çocuk Soket Çorap Tavşan Desenli 6'lı Set Asorti</p>";
const ACK = '<p>Trendyol Ürün Açıklaması</p><p>- 6\'lı asorti set: Paket içerisinde toplam 6 çift kız çocuk soket çorabı bulunur.</p><p>- Dikişsiz burun: Dikişsiz burun yapısına sahiptir.</p>';
const TAM = GOVDE + SEO + AD + ACK;

describe('kapı', () => {
  it('üç blok + başlıkları + gövdeleri düşer; önceki her bayt aynen kalır', () => {
    expect(kuyrukSoy(TAM, BASLIK)).toBe(GOVDE);
    expect(karar(BASLIK, TAM)).toMatchObject({ durum: 'soyulacak', html: GOVDE, turler: ['seo', 'ad', 'aciklama'] });
  });
  it('NEGATİF: gövde · Öne Çıkanlar · Teknik Bilgiler · Bakım değişmez', () => {
    const k = karar(BASLIK, TAM);
    if (k.durum !== 'soyulacak') throw new Error(k.durum);
    expect(TAM.startsWith(k.html)).toBe(true);
    for (const s of ['tasarlanmış 6 çiftlik asorti settir.', '<p>Öne Çıkanlar</p>', '<p>Teknik Bilgiler</p>', '<p>Marka Pola Concept</p>', '<p>Bakım Talimatları</p>', '<p>- Dikişsiz burun</p>']) expect(k.html).toContain(s);
  });
  it('NEGATİF: blok yokken değişmez', () => {
    expect(karar(BASLIK, GOVDE)).toMatchObject({ durum: 'degisiklik-yok' });
    expect(kuyrukSoy(GOVDE, BASLIK)).toBe(GOVDE);
  });
  it('varyant başlıklar («SEO Etiketleri», «Trendyol Açıklaması») ve ayraçlar da düşer', () => {
    const h = GOVDE + '<p>SEO Etiketleri</p><p>pola kız çocuk çorap, pola concept çorap, kız çocuk dizaltı çorap</p><p>________________________________________</p>'
      + "<p>Trendyol Ürün Adı</p><p>Pola Kız Çocuk Pamuk Dizaltı Çorap 3’lü Set Ekru Beyaz Pembe</p><p>--</p><p>Trendyol Açıklaması</p><p>• Üretim: Türkiye'de üretilmiş</p>";
    expect(kuyrukSoy(h, BASLIK)).toBe(GOVDE);
  });
  it('Trendyol adı varyant ayrıntısı taşısa da (örtüşme < 0,6) blok başlığı altında ad sayılır', () => {
    expect(adGovdesiMi("Pola Concept Bambu Erkek Garson Soket Çorap 6'lı Set Dikişsiz Burun Düz Renk Asorti 38-40", "Pola Bambu Erkek Garson Soket Çorap 6'lı SET")).toBe(true);
  });
});

describe('blok başına şüphe → ürün ATLANIR, tek bayt yazılmaz', () => {
  it('SEO gövdesi anahtar sözcük listesi değilse', () => {
    expect(seoListesiMi('Pola Concept çorapları günlük kullanım için uygundur.')).toBe(false);
    const h = GOVDE + '<p>Ürün Etiketleri (SEO)</p><p>Bu çoraplar, okul, spor ve günlük kullanım için uygundur.</p>' + AD + ACK;
    expect(karar(BASLIK, h)).toMatchObject({ durum: 'atlandi' });
  });
  it('Trendyol ad gövdesi cümleyse ya da başka markayla başlıyorsa', () => {
    expect(karar(BASLIK, GOVDE + SEO + '<p>Trendyol Ürün Adı</p><p>Pola çoraplar günlük kullanım için tasarlanmıştır.</p>' + ACK)).toMatchObject({ durum: 'atlandi' });
    expect(karar(BASLIK, GOVDE + SEO + "<p>Trendyol Ürün Adı</p><p>Penti Kız Çocuk Soket Çorap 6'lı Set</p>" + ACK)).toMatchObject({ durum: 'atlandi' });
  });
  it('Trendyol açıklama bloğunda madde olmayan paragraf varsa (canlı: sohbet artığı)', () => {
    const h = TAM + '<p>Bu konuşma şimdiye kadar faydalı oldu mu?</p>';
    expect(karar(BASLIK, h)).toMatchObject({ durum: 'atlandi' });
    expect(kuyrukSoy(h, BASLIK)).toBe(h);
  });
  it('Trendyol açıklama başlığının altında hiç madde yoksa', () => {
    expect(karar(BASLIK, GOVDE + SEO + AD + '<p>Trendyol Ürün Açıklaması</p>')).toMatchObject({ durum: 'atlandi' });
  });
  it('blokların arasında ya da sonunda blok dışı müşteri içeriği varsa', () => {
    expect(karar(BASLIK, GOVDE + SEO + '<p>Kargo ve İade</p>' + AD + ACK)).toMatchObject({ durum: 'atlandi' });
  });
  it('aynı blok iki kez geçiyorsa', () => {
    expect(karar(BASLIK, GOVDE + SEO + AD + SEO + ACK)).toMatchObject({ durum: 'atlandi' });
  });
  it('blok başlığı ilk paragrafsa (önünde içerik kalmaz)', () => {
    expect(karar(BASLIK, SEO + AD + ACK)).toMatchObject({ durum: 'atlandi' });
  });
  it('kuyrukta paragraf dışı içerik varsa', () => {
    const k = karar(BASLIK, GOVDE + SEO + '<div>x</div>' + AD + ACK);
    expect(k).toMatchObject({ durum: 'atlandi' });
    expect(k.durum === 'atlandi' && k.sebep).toMatch(/paragraf dışı/); // metin kapısına kalmadan, kendi kapısında düşer
  });
});

describe('metin kapısı + idempotans', () => {
  it('düz metni beklenenden farklı üreten dönüşüm YAZILMAZ', () => {
    const bozuk = (h: string, b: string) => kuyrukSoy(h, b).replace('Öne Çıkanlar', '');
    expect(karar(BASLIK, TAM, bozuk)).toMatchObject({ durum: 'atlandi' });
  });
  it('ikinci uygulama değişiklik üretmez', () => {
    expect(karar(BASLIK, kuyrukSoy(TAM, BASLIK))).toMatchObject({ durum: 'degisiklik-yok' });
  });
});

describe('çalıştırıcı', () => {
  const urun = { id: 'gid://shopify/Product/1', handle: 'pola-x', baslik: BASLIK, html: TAM };
  it('dry-run yaz çağırmaz', async () => {
    let yazildi = 0; const k: KutukSatiri[] = [];
    const oz = await blokCalistir([urun], { oku: async () => TAM, yaz: async () => { yazildi++; return { ok: true }; }, kutuk: (s) => k.push(s) }, { uygula: false });
    expect(yazildi).toBe(0); expect(oz).toMatchObject({ taranan: 1, soyulacak: 1 }); expect(k[0]).toMatchObject({ durum: 'soyulacak' });
  });
  it('uygula: yazar, kütüğe ÖNCESİ HTML düşer; ikinci koşu değişiklik-yok', async () => {
    let db = TAM; const k: KutukSatiri[] = [];
    const dep = { oku: async () => db, yaz: async (_: string, h: string) => { db = h; return { ok: true as const }; }, kutuk: (s: KutukSatiri) => k.push(s) };
    expect(await blokCalistir([urun], dep, { uygula: true })).toMatchObject({ soyuldu: 1 });
    expect(db).toBe(GOVDE); expect(k[0]).toMatchObject({ durum: 'soyuldu', onceHtml: TAM });
    expect(await blokCalistir([{ ...urun, html: db }], dep, { uygula: true })).toMatchObject({ soyuldu: 0, degisiklikYok: 1 });
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazmaz', async () => {
    let yazildi = 0;
    const oz = await blokCalistir([urun], { oku: async () => TAM + '<p>yeni</p>', yaz: async () => { yazildi++; return { ok: true }; }, kutuk: () => {} }, { uygula: true });
    expect(yazildi).toBe(0); expect(oz.atlandi).toBe(1);
  });
});
