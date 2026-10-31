/**
 * #994831 · İKİ AÇIKLAMA DÜZELTMESİ ÇİVİSİ.
 * MUTASYON: tekillik kapısı, metin kapısı, liste kapsamı, düzeltme metni ya da yeniden okuma bozulursa ilgili
 * iddialar KIRILIR. Girdiler 31 Eki 2026 canlı açıklamalarının BİREBİR kopyası (Admin API dökümü).
 */
import { describe, expect, it } from 'vitest';
import { DUZELTMELER, duzeltmeCalistir, karar, type KutukSatiri } from '../src/lib/aciklama-duzeltme';
import { duzMetin } from '../src/lib/aciklama-ic-not';

const H100 = '100-lt-saklama-kutusu-2li-set';
const HKARE = 'kare-4lu-ahsap-vakumlu-kare-kapakli-cam-kahvaltilik-cok-amacli-cam-cerezlik-235-ml';
const C100 = "<p class=\"font-claude-response-body break-words whitespace-normal\">Ev, garaj, depo ve atölyeniz için güçlü depolama çözümü. Türkiye'de üretilen Super-Bag ağır hizmet tipi saklama kutuları, 3'lü set halinde Via Mood güvencesiyle.</p>\n<ul class=\"[li_&amp;]:mb-0 [li_&amp;]:mt-1 [li_&amp;]:gap-1 [&amp;:not(:last-child)_ul]:pb-1 [&amp;:not(:last-child)_ol]:pb-1 list-disc flex flex-col gap-1 pl-8 mb-3\">\n<li class=\"font-claude-response-body whitespace-normal break-words pl-2\">\n<strong>100 Lt geniş hacim:</strong> Toplam 100 litre depolama alanı — kışlık eşyalar, el aletleri, oyuncaklar, arşiv dosyaları için ideal</li>\n<li class=\"font-claude-response-body whitespace-normal break-words pl-2\">\n<strong>Ağır hizmet dayanıklılığı:</strong> Darbeye dayanıklı polipropilen gövde; kırılmaz, esnemez, formunu korur</li>\n<li class=\"font-claude-response-body whitespace-normal break-words pl-2\">\n<strong>Kilitlenebilir kapak:</strong> Sarı güvenlik klipsleri ve asma kilit delikleriyle içerikleriniz güvende</li>\n<li class=\"font-claude-response-body whitespace-normal break-words pl-2\">\n<strong>İç/dış mekan kullanımı:</strong> Toza ve neme karşı korumalı kapak yapısı</li>\n<li class=\"font-claude-response-body whitespace-normal break-words pl-2\">\n<strong>İstiflenebilir tasarım:</strong> Üst üste dizilerek yerden tasarruf sağlar</li>\n</ul>";
const CKARE = "<p class=\"product-description-content\">Kare 4'lı Ahşap Vakumlu Kare Kapaklı Cam Kahvaltılık Çok Amaçlı Cam Çerezlik 230 ml</p>\n<p class=\"product-description-content\">Ürün Malzemesi</p>\n<p class=\"product-description-content\">Kapak : Ahşap Hazne : Cam</p>\n<p class=\"product-description-content\">Ürün Hacmi : 235 ml</p>\n<p class=\"product-description-content\">Ürün Ölçüleri : 8 x 6 cm</p>\n<p class=\"product-description-content\">Birinci kalite kalın camdan üretilmiştir. Ürün Çok amaçlı olarak kullanılabilmektedir.Vakumlu kapağı sayesinde kahvaltılıklarınızı bozulmadan saklamanızı sağlayacak aynı zamanda çerezlik olarak kullanmak isterseniz çerezlerinizin taze kalmasını sağlayacaktır , ürün yapısı gereği baharatlık olarak ta kullanılabilmektedir. Ürün cam haznesi bulaşık makinesinde yıkanabilir.</p>\n";

describe('kapsam', () => {
  it('TAM İKİ ürün listede; super-bag başlık çelişkisi (ticari teyit) listede YOK', () => {
    expect(Object.keys(DUZELTMELER).sort()).toEqual([H100, HKARE].sort());
    expect(Object.keys(DUZELTMELER).some((h) => h.includes('super-bag'))).toBe(false);
  });
  it('başka ürüne dokunmaz: listede olmayan handle değişiklik-yok', () => {
    expect(karar('super-bag-20-lt-saklama-kutusu-wikro-tank-bezi', C100)).toMatchObject({ durum: 'degisiklik-yok' });
    expect(karar('yuvarlak-4lu-ahsap-vakumlu-yuvarlak-kapakli-cam-kahvaltilik-cok-amacli-cam-cerezlik-235-ml', CKARE)).toMatchObject({ durum: 'degisiklik-yok' });
  });
});

describe("100 LT 2'li set", () => {
  it("«3'lü set halinde» → «2'li set halinde» ve «Toplam 100 litre» → «Toplam 200 litre (2 × 100 Lt)»; geri kalan bayt bayt aynı", () => {
    const k = karar(H100, C100);
    if (k.durum !== 'duzeltilecek') throw new Error(k.durum);
    expect(k.html).toContain("2'li set halinde"); expect(k.html).not.toContain("3'lü set halinde");
    expect(k.html).toContain('Toplam 200 litre (2 × 100 Lt) depolama alanı'); expect(k.html).not.toContain('Toplam 100 litre');
    expect(k.html.replace("2'li set halinde", "3'lü set halinde").replace('Toplam 200 litre (2 × 100 Lt) depolama alanı', 'Toplam 100 litre depolama alanı')).toBe(C100);
    expect(k.html).toContain('<strong>100 Lt geniş hacim:</strong>'); // kutu başına hacim başlığı korunur
  });
});

describe('kare çerezlik', () => {
  it('ilk satırdaki «230 ml» → «235 ml»; teknik satır ve geri kalan bayt bayt aynı', () => {
    const k = karar(HKARE, CKARE);
    if (k.durum !== 'duzeltilecek') throw new Error(k.durum);
    expect(k.html).not.toContain('230 ml');
    expect(k.html.replace('Çerezlik 235 ml</p>', 'Çerezlik 230 ml</p>')).toBe(CKARE);
    expect(duzMetin(k.html)).toContain('Ürün Hacmi : 235 ml');
  });
});

describe('negatifler + idempotans', () => {
  it('NEGATİF: hedef ifade yokken değişmez (atlanır, tek bayt yazılmaz)', () => {
    expect(karar(H100, '<p>Saklama kutusu.</p>')).toMatchObject({ durum: 'atlandi' });
    expect(karar(HKARE, '<p>Çerezlik.</p>')).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF: hedef ifade iki kez geçiyorsa (tekil değil) atlanır', () => {
    expect(karar(HKARE, CKARE + '<p>Cam Çerezlik 230 ml</p>')).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF: hedef HTML\'de tekil ama düz metni metinde iki kez geçiyorsa atlanır (yanlış yeri değiştirme riski)', () => {
    expect(karar(HKARE, CKARE + '<p>Çerezlik 230 ml ölçüsündedir</p>')).toMatchObject({ durum: 'atlandi' });
  });
  it('ikinci uygulama değişiklik üretmez; yarım uygulanmış hâl atlanır', () => {
    for (const [h, c] of [[H100, C100], [HKARE, CKARE]] as const) {
      const k = karar(h, c); if (k.durum !== 'duzeltilecek') throw new Error(k.durum);
      expect(karar(h, k.html)).toMatchObject({ durum: 'degisiklik-yok' });
    }
    expect(karar(H100, C100.replace("3'lü set halinde", "2'li set halinde"))).toMatchObject({ durum: 'atlandi' });
  });
  it('metin kapısı: HTML işaretlemesine taşan hedef ifade (öznitelik içi) düz metinde yok → YAZILMAZ', () => {
    const tasan = { [HKARE]: [{ eski: 'product-description-content">Kare', yeni: 'product-description-content">KARE', kanit: 'x' }] };
    expect(karar(HKARE, CKARE, tasan)).toMatchObject({ durum: 'atlandi' });
  });
});

describe('çalıştırıcı', () => {
  const u = { id: 'gid://shopify/Product/1', handle: HKARE, html: CKARE };
  it('dry-run yaz çağırmaz', async () => {
    let n = 0; const oz = await duzeltmeCalistir([u], { oku: async () => CKARE, yaz: async () => { n++; return { ok: true }; }, kutuk: () => {} }, { uygula: false });
    expect(n).toBe(0); expect(oz.duzeltilecek).toBe(1);
  });
  it('uygula: yazar, kütüğe ÖNCESİ HTML; ikinci koşu değişiklik-yok', async () => {
    let db = CKARE; const k: KutukSatiri[] = [];
    const dep = { oku: async () => db, yaz: async (_: string, h: string) => { db = h; return { ok: true as const }; }, kutuk: (s: KutukSatiri) => k.push(s) };
    expect(await duzeltmeCalistir([u], dep, { uygula: true })).toMatchObject({ duzeltildi: 1 });
    expect(k[0]).toMatchObject({ durum: 'duzeltildi', onceHtml: CKARE });
    expect(await duzeltmeCalistir([{ ...u, html: db }], dep, { uygula: true })).toMatchObject({ duzeltildi: 0, degisiklikYok: 1 });
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazmaz', async () => {
    let n = 0; const oz = await duzeltmeCalistir([u], { oku: async () => CKARE + 'x', yaz: async () => { n++; return { ok: true }; }, kutuk: () => {} }, { uygula: true });
    expect(n).toBe(0); expect(oz.atlandi).toBe(1);
  });
});
