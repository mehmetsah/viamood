/**
 * #994831 · DALGA 7 · BAŞTAKİ İÇ BAŞLIK ÇİVİSİ.
 * MUTASYON: ad satırı kapısı, SEO listesi kapısı, «yalnız baştan ardışık» koşulu, işaret başlığı, metin kapısı,
 * yeniden okuma ya da dry-run kaldırılırsa ilgili iddialar KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { basSoy, blokCalistir, karar, type KutukSatiri } from '../src/lib/aciklama-bas-blok';
import { tekrarSoy } from '../src/lib/aciklama-baslik-tekrar';

// Canlı biçim (31 Eki 2026, smartduo-iki-bolmeli-camasir-sepeti-84lt-2, span parçalı, kısaltıldı)
const BASLIK = 'SmartDuo 84 LT İki Bölmeli Kahverengi/Bej Çamaşır Sepeti | Havalandırmalı Büyük Boy Kirli Sepeti';
const IC = '<h2>\n<span>Ürün </span><span>Başlığı</span>\n</h2>\n<p><span>SmartDuo 84 LT İki Bölmeli Kahverengi/BejÇamaşır Sepeti | Delikli Havalandırmalı Kirli Sepeti</span></p>\n'
  + '<h2>\n<span>Shopify </span><span>Ürün </span><span>Açıklaması</span>\n</h2>\n';
const GOVDE = '<h3>\n<span>SmartDuo </span><span>84 </span><span>LT </span><span>Çamaşır </span><span>Sepeti</span>\n</h3>\n'
  + '<p><span>Çamaşır odasında ve banyoda daha düzenli bir görünüm için tasarlanan SmartDuo, pratik kullanım özelliklerini bir araya getiriyor.</span></p>\n'
  + '<h3>Öne Çıkanlar</h3><ul><li>84 litre geniş toplam kapasite</li></ul><h2>Teknik Bilgiler</h2><table><tr><td>Model</td><td>SmartDuo</td></tr></table>'
  + '<h2>Paket İçeriği</h2><p>Paket içerisinde 1 adet SmartDuo çamaşır sepeti bulunur.</p>';
const H = IC + GOVDE;

describe('kapı', () => {
  it('baştaki iç dizi (span parçalı h2 + ad satırı + işaret başlığı) düşer; asıl açıklama bayt bayt kalır', () => {
    expect(basSoy(H, BASLIK)).toBe(GOVDE);
    expect(karar(BASLIK, H)).toMatchObject({ durum: 'soyulacak', html: GOVDE, turler: ['ad', 'isaret'], silinen: ['Ürün Başlığı', 'SmartDuo 84 LT İki Bölmeli Kahverengi/BejÇamaşır Sepeti | Delikli Havalandırmalı Kirli Sepeti', 'Shopify Ürün Açıklaması'] });
  });
  it('NEGATİF: gövdeye dokunmaz — h3 ad başlığı, gövde cümlesi, Öne Çıkanlar, Teknik Bilgiler, Paket İçeriği aynen', () => {
    const k = karar(BASLIK, H);
    if (k.durum !== 'soyulacak') throw new Error(k.durum);
    for (const s of ['<h3>\n<span>SmartDuo </span>', 'bir araya getiriyor.', '<h3>Öne Çıkanlar</h3>', '<h2>Teknik Bilgiler</h2>', '<h2>Paket İçeriği</h2>']) expect(k.html).toContain(s);
  });
  it('NEGATİF: başta iç başlık yokken değişmez', () => {
    expect(karar(BASLIK, GOVDE)).toMatchObject({ durum: 'degisiklik-yok' });
    expect(basSoy(GOVDE, BASLIK)).toBe(GOVDE);
  });
  it('NEGATİF: iç başlık gövdenin ORTASINDAYSA dokunulmaz (yalnız baştan ardışık)', () => {
    const h = GOVDE + IC + '<p>Son paragraf.</p>';
    expect(karar(BASLIK, h)).toMatchObject({ durum: 'degisiklik-yok' });
  });
  it('NEGATİF: öndeki müşteri içeriğinden sonra gelen iç başlığa dokunulmaz', () => {
    const h = '<div>Kampanya</div>' + IC + GOVDE;
    expect(basSoy(h, BASLIK)).toBe(h);
  });
  it('«Ürün Başlığı» altındaki satır ürün adı değilse (cümle) ATLANIR', () => {
    const h = '<h2>Ürün Başlığı</h2><p>SmartDuo ile çamaşırlarınız her zaman düzenli kalır.</p>' + GOVDE;
    expect(karar(BASLIK, h)).toMatchObject({ durum: 'atlandi' });
  });
  it('«Ürün Başlığı» altındaki satır başka markayla başlıyorsa ATLANIR', () => {
    expect(karar(BASLIK, "<h2>Ürün Başlığı</h2><p>Tontarelli 84 LT Çamaşır Sepeti</p>" + GOVDE)).toMatchObject({ durum: 'atlandi' });
  });
  it('baştaki SEO bloğu: liste ise düşer, cümle ise ATLANIR', () => {
    const seo = '<h2>Ürün Etiketleri (SEO)</h2><p>smartduo çamaşır sepeti, kirli sepeti, iki bölmeli sepet</p>';
    expect(basSoy(seo + GOVDE, BASLIK)).toBe(GOVDE);
    expect(karar(BASLIK, '<h2>Ürün Etiketleri (SEO)</h2><p>Bu sepet, banyo, ev ve ofis için uygundur.</p>' + GOVDE)).toMatchObject({ durum: 'atlandi' });
  });
  it('aynı iç başlık iki kez geçiyorsa ATLANIR', () => {
    expect(karar(BASLIK, '<h2>Shopify Ürün Açıklaması</h2><h2>Shopify Ürün Açıklaması</h2>' + GOVDE)).toMatchObject({ durum: 'atlandi' });
  });
  it('yalnız iç başlıklardan oluşan açıklama boşaltılmaz', () => {
    expect(karar(BASLIK, '<h2>Shopify Ürün Açıklaması</h2><h3>SmartDuo</h3>')).toMatchObject({ durum: 'atlandi' });
  });
  it('metin kapısı: düz metni beklenenden farklı üreten dönüşüm YAZILMAZ', () => {
    const bozuk = (h: string, b: string) => basSoy(h, b).replace('Öne Çıkanlar', '');
    expect(karar(BASLIK, H, bozuk)).toMatchObject({ durum: 'atlandi' });
  });
});

describe('idempotans + A2 ile birlikte tutarlılık', () => {
  it('ikinci uygulama değişiklik üretmez', () => {
    expect(karar(BASLIK, basSoy(H, BASLIK))).toMatchObject({ durum: 'degisiklik-yok' });
  });
  it('aynı ürün iki kalıba da uyarsa (baş iç blok + A2 ad paragrafı): bileşik dönüşüm tek geçişte durağan, gövde sağlam', () => {
    const PB = "Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı SET";
    const bas = "<h2>Ürün Başlığı</h2><p>Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı Set</p><h2>Shopify Ürün Açıklaması</h2>";
    const ad = "<p>Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı Set | 40-44 Beden</p>";
    const gov = '<p>Pola Concept erkek bambu sneaker çorap seti, günlük kullanım için tasarlanmıştır.</p><p>Öne Çıkanlar</p>';
    const f = (h: string) => tekrarSoy(basSoy(h, PB), PB);
    expect(f(bas + ad + gov)).toBe(gov);
    expect(f(f(bas + ad + gov))).toBe(gov);
    // A2 tek başına baştaki h2'yi görünce hiçbir şeye dokunmaz (çakışma yok): sıra bas → A2
    expect(tekrarSoy(bas + ad + gov, PB)).toBe(bas + ad + gov);
    // bas kapısı A2'nin ad paragrafını ALMAZ (o A2'nin işi)
    expect(basSoy(bas + ad + gov, PB)).toBe(ad + gov);
  });
});

describe('çalıştırıcı', () => {
  const urun = { id: 'gid://shopify/Product/1', handle: 'smartduo-x', baslik: BASLIK, html: H };
  it('dry-run yaz çağırmaz', async () => {
    let yazildi = 0; const k: KutukSatiri[] = [];
    const oz = await blokCalistir([urun], { oku: async () => H, yaz: async () => { yazildi++; return { ok: true }; }, kutuk: (s) => k.push(s) }, { uygula: false });
    expect(yazildi).toBe(0); expect(oz).toMatchObject({ taranan: 1, soyulacak: 1 });
  });
  it('uygula: yazar, kütüğe ÖNCESİ HTML düşer; ikinci koşu değişiklik-yok', async () => {
    let db = H; const k: KutukSatiri[] = [];
    const dep = { oku: async () => db, yaz: async (_: string, h: string) => { db = h; return { ok: true as const }; }, kutuk: (s: KutukSatiri) => k.push(s) };
    expect(await blokCalistir([urun], dep, { uygula: true })).toMatchObject({ soyuldu: 1 });
    expect(db).toBe(GOVDE); expect(k[0]).toMatchObject({ durum: 'soyuldu', onceHtml: H });
    expect(await blokCalistir([{ ...urun, html: db }], dep, { uygula: true })).toMatchObject({ soyuldu: 0, degisiklikYok: 1 });
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazmaz', async () => {
    let yazildi = 0;
    const oz = await blokCalistir([urun], { oku: async () => H + '<p>yeni</p>', yaz: async () => { yazildi++; return { ok: true }; }, kutuk: () => {} }, { uygula: true });
    expect(yazildi).toBe(0); expect(oz.atlandi).toBe(1);
  });
});
