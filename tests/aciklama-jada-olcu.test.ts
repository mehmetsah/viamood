/**
 * #994831 · JADA STITCH ÖLÇÜ METNİ · ÇİVİ (Mehmet kararı 1 Kas 2026: «ölçü ifadeleri TEK ve kaynaklı hâle getirilecek»).
 * Girdi: veri/994831-aciklama-jada-olcu.jsonl (oncekiHtml = canlı açıklamanın birebir kopyası, Admin API 31 Eki 2026 21:22Z).
 * Dört ürün aynı asorti EAN'ı (4006333098833) taşır: SKU 505 Stitch · 506 Hula · 507 Surfing · 508 Ukulele.
 *  · «Boyut 6,35 cm (2.5")» serinin ölçek adıdır, figür boyu değil → ürünün kendi görselindeki ölçü çizgisi yazılır,
 *  · «Ürün Ölçüsü 6,35 × 2,6 × 3,5 cm» kaynaksız → satır düşer, Surfing baş satırındaki «6,5 cm» → «5 cm» (başlıkla aynı),
 *  · 505/506/507 görseli «2in / 5.08cm» → «Yaklaşık 5 cm»; 508 (Ukulele) görseli «2.25in / 5.72cm» → «Yaklaşık 5,7 cm».
 *  · «Gönderilecek karakter stok durumuna göre değişiklik gösterebilir» cümlesine DOKUNULMAZ (satış şekli Mehmet'te).
 * MUTASYON: metin/kaynak/öncesi/korunan/yasak ölçü kapıları, dry-run ve yeniden okuma kaldırılırsa ilgili iddialar KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { degistirCalistir, olcuKarar, olcuMu, olcuUygula, type KutukSatiri, type OlcuGiris } from '../src/lib/aciklama-degistir';
import { duzMetin } from '../src/lib/aciklama-ic-not';

const KOK = path.join(__dirname, '..');
const G = readFileSync(path.join(KOK, 'veri', '994831-aciklama-jada-olcu.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as OlcuGiris & { sku: string });
const SKU = Object.fromEntries(G.map((g) => [g.sku, g]));
const HANDLE = {
  '505': 'jada-disney-stitch-die-cast-metal-figur-5-cm-lisansli-koleksiyon-figuru-stitch-karakteri',
  '506': 'jada-disney-hula-stitch-die-cast-metal-figur-5-cm-lisansli-koleksiyon-figuru-hula-dans-yapan-stitch',
  '507': 'jada-disney-hula-stitch-die-cast-metal-figur-5-cm-lisansli-koleksiyon-figuru-hula-dans-yapan-stitch-kopya',
  '508': 'jada-disney-ukulele-stitch-die-cast-metal-figur-5-cm-lisansli-koleksiyon-figuru-ukulele-calan-stitch',
};
const KAYNAKSIZ = ['6,35', '6,5 cm', '2,6 × 3,5', '2.5"', 'Ürün Ölçüsü'];
const STOK = 'Gönderilecek karakter stok durumuna göre değişiklik gösterebilir.';
const kesin = (k: ReturnType<typeof olcuKarar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };
const kopya = (g: OlcuGiris, d: Partial<OlcuGiris>): OlcuGiris => ({ ...structuredClone(g), ...d });
const tekrar = (s: string, p: string) => s.split(p).length - 1;

describe('veri ve kaynak şartı', () => {
  it('tam 4 ürün (SKU 505-508), hepsi ölçü satırı, hepsi aynı asorti EAN; başka ürün yok', () => {
    expect(G).toHaveLength(4);
    expect(Object.keys(SKU).sort()).toEqual(['505', '506', '507', '508']);
    for (const [s, h] of Object.entries(HANDLE)) expect(SKU[s]!.handle).toBe(h);
    for (const g of G) { expect(olcuMu(g)).toBe(true); expect(g.oncekiHtml).toContain('<td>4006333098833</td>'); expect(g.baslik).toMatch(/^Jada Disney .*Stitch Die-Cast Metal Figür 5 cm \| Lisanslı Koleksiyon Figürü/); }
  });
  it('ölçü kaynağı ürünün KENDİ görselindeki ölçü çizgisi (aynı SKU), ifade alıntıdaki sayıdan türer', () => {
    for (const g of G) {
      expect(g.olcu.kaynak.tur).toBe('urun-gorseli');
      expect(g.olcu.kaynak.kaynak).toMatch(new RegExp(`/files/${g.sku}-\\d\\.jpg$`));
    }
    for (const s of ['505', '506', '507']) { expect(SKU[s]!.olcu.kaynak.alinti).toBe('2in / 5.08cm'); expect(SKU[s]!.olcu.ifade).toBe('Yaklaşık 5 cm'); }
    expect(SKU['508']!.olcu.kaynak.alinti).toBe('2.25in / 5.72cm');
    expect(SKU['508']!.olcu.ifade).toBe('Yaklaşık 5,7 cm');
  });
  it('yeni HTML = değişimlerin öncesine birebir uygulanmış hâli; değişen her satır bir ölçü satırı', () => {
    for (const g of G) {
      expect(g.yeniHtml).toBe(olcuUygula(g.oncekiHtml, g.degisimler));
      const o = g.oncekiHtml.split('\n'), y = g.yeniHtml.split('\n');
      const giden = o.filter((x) => !y.includes(x)), gelen = y.filter((x) => !o.includes(x));
      for (const x of [...giden, ...gelen]) expect(x, x).toMatch(/cm|<tr>|<\/tr>|Ürün Ölçüsü/);
      expect(gelen.length).toBeLessThanOrEqual(giden.length);
    }
  });
});

describe('ölçü metni', () => {
  it('canlı = öncesi iken yazılacak = yeniHtml (kip ölçü)', () => {
    for (const g of G) { const k = kesin(olcuKarar(g, g.oncekiHtml)); expect(k.kip).toBe('olcu'); expect(k.html).toBe(g.yeniHtml); }
  });
  it('yeni metinde 6,35 / 6,5 cm / 6,35 × 2,6 × 3,5 / 2.5" figür ölçüsü olarak GEÇMEZ (öncesinde geçiyordu)', () => {
    for (const g of G) {
      const o = duzMetin(g.oncekiHtml), y = duzMetin(g.yeniHtml);
      expect(o).toContain('6,35 cm');
      for (const x of KAYNAKSIZ) expect(y.includes(x), `${g.sku} ${x}`).toBe(false);
    }
    expect(duzMetin(SKU['507']!.oncekiHtml)).toContain('Figür 6,5 cm');
    expect(duzMetin(SKU['507']!.yeniHtml)).toContain('Surfing Stitch Die-Cast Metal Figür 5 cm |');
  });
  it('505/506/507: «Yaklaşık 5 cm» var, Boyut satırı «Yaklaşık 5 cm (2 inç)»; 508: «Yaklaşık 5,7 cm» var, çıplak «5 cm» kalmadı', () => {
    for (const s of ['505', '506', '507']) {
      const y = duzMetin(SKU[s]!.yeniHtml);
      expect(y).toContain('Yaklaşık 5 cm boyut');
      expect(y).toContain('Boyut Yaklaşık 5 cm (2 inç)');
      expect(y).not.toContain('5,7');
    }
    const u = duzMetin(SKU['508']!.yeniHtml);
    expect(u).toContain('Yaklaşık 5,7 cm boyut');
    expect(u).toContain('Boyut Yaklaşık 5,7 cm (2,25 inç)');
    expect(u).toContain('Ukulele Stitch Die-Cast Metal Figür 5,7 cm |');
    expect(u).not.toMatch(/(^|[^\d,])5 cm/);
  });
  it('dokunulmayanlar: stok cümlesi, tekli satış, kutu ölçüsü, barkod satırı, karakter çeşitleri aynen kalır', () => {
    for (const g of G) {
      const o = duzMetin(g.oncekiHtml), y = duzMetin(g.yeniHtml);
      for (const x of [STOK, 'Ürün tekli satılmaktadır.', '4 farklı karakter seçeneği', 'Kutu Ölçüsü 8,1 × 4,8 × 8,1 cm', 'Barkod 4006333098833', 'Karakter Çeşitleri Stitch Hula Stitch Surfing Stitch Ukulele Stitch']) {
        expect(tekrar(o, x), x).toBe(1); expect(tekrar(y, x), x).toBe(1);
      }
    }
  });
  it('idempotans: canlı zaten yeni metinse (Shopify satır sonu ekleşe de) değişiklik-yok', () => {
    for (const g of G) expect(olcuKarar(g, g.yeniHtml.replace(/\n/g, '\r\n'))).toMatchObject({ durum: 'degisiklik-yok' });
  });
});

describe('kapılar (negatif)', () => {
  const g = SKU['505']!;
  const yeniden = (d: OlcuGiris['degisimler']) => kopya(g, { degisimler: d, yeniHtml: olcuUygula(g.oncekiHtml, d) ?? '' });
  it('canlı öncesinden farklıysa YAZMAZ', () => {
    expect(olcuKarar(g, g.oncekiHtml.replace('Jada Toys</td>', 'Jada</td>'))).toMatchObject({ durum: 'atlandi' });
  });
  it('metin kapısı: yeniHtml değişimlerin çıktısı değilse YAZMAZ', () => {
    expect(olcuKarar(kopya(g, { yeniHtml: g.yeniHtml.replace('Die-Cast Metal</td>', 'Çinko alaşım</td>') }), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
  });
  it('kaynakta olmayan sayı (6 cm, 2,5 inç) YAZILMAZ', () => {
    for (const yeni of ['<td>Boyut</td>\n<td>Yaklaşık 6 cm</td>', '<td>Boyut</td>\n<td>Yaklaşık 5 cm (2,5 inç)</td>']) {
      const d = [{ ...g.degisimler[0]!, yeni }, ...g.degisimler.slice(1)];
      expect(olcuKarar(yeniden(d), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('kaynakta olmayan sayı') });
    }
  });
  it('kaynaksız ölçü yeni metinde kalırsa (Ürün Ölçüsü satırı düşmezse) YAZMAZ', () => {
    expect(olcuKarar(yeniden(g.degisimler.slice(0, 1)), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('kaynaksız ölçü') });
  });
  it('korunan stok cümlesi değişirse YAZMAZ', () => {
    const d = [...g.degisimler, { eski: ' Gönderilecek karakter stok durumuna göre değişiklik gösterebilir.', yeni: '' }];
    expect(olcuKarar(yeniden(d), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('korunan cümle') });
  });
  it('kaynak ürün görseli değilse ya da ifade yeni metinde yoksa YAZMAZ', () => {
    expect(olcuKarar(kopya(g, { olcu: { ...g.olcu, kaynak: { ...g.olcu.kaynak, tur: 'baslik' } } }), g.oncekiHtml)).toMatchObject({ durum: 'atlandi' });
    expect(olcuKarar(kopya(g, { olcu: { ...g.olcu, ifade: 'Yaklaşık 7 cm' } }), g.oncekiHtml)).toMatchObject({ durum: 'atlandi' });
  });
  it('iç blok (Kategori kuyruğu) ya da yasak sözcük (kargo) getiren değişim YAZILMAZ', () => {
    const son = 'değişiklik gösterebilir.</p>';
    expect(olcuKarar(yeniden([...g.degisimler, { eski: son, yeni: `${son}\n<p>Kategori</p>\n<p>Oyuncaklar &gt; Figürler</p>` }]), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('iç blok') });
    expect(olcuKarar(yeniden([...g.degisimler, { eski: '<td>Gerektirmez</td>', yeni: '<td>Gerektirmez, hızlı kargo</td>' }]), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yasak sözcük') });
  });
  it('öncesinde kaynaksız ölçü yoksa (sorun ölçülmediyse) YAZMAZ', () => {
    expect(olcuKarar(kopya(g, { yasakOlculer: ['9,99 cm'] }), g.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('ölçülmedi') });
  });
  it('değişim parçası öncesinde tam bir kez geçmiyorsa ya da parçalar örtüşüyorsa uygulanmaz', () => {
    expect(olcuUygula(g.oncekiHtml, [{ eski: '<tr>\n<td>', yeni: '' }])).toBeNull();
    expect(olcuUygula(g.oncekiHtml, [{ eski: 'yok-boyle-parca', yeni: '' }])).toBeNull();
    expect(olcuUygula(g.oncekiHtml, [{ eski: '6,35 cm (2.5")', yeni: 'x' }, { eski: '<td>6,35 cm (2.5")</td>', yeni: 'y' }])).toBeNull();
    expect(olcuUygula(g.oncekiHtml, [])).toBeNull();
  });
});

describe('çalıştırıcı', () => {
  const sahte = (canli: Record<string, string>, okuFark = false) => {
    const yazilan: string[] = [], kutuk: KutukSatiri[] = [];
    const urunler = Object.fromEntries(Object.entries(canli).map(([h, html], i) => [h, { id: `gid://shopify/Product/${i}`, handle: h, html }]));
    return {
      yazilan, kutuk,
      dep: {
        bul: async (h: string) => urunler[h] ?? null,
        oku: async (id: string) => { const u = Object.values(urunler).find((x) => x.id === id)!; return okuFark ? u.html + ' ' : u.html; },
        yaz: async (id: string) => { yazilan.push(id); return { ok: true as const }; },
        kutuk: (s: KutukSatiri) => kutuk.push(s),
      },
    };
  };
  const canli = { ...Object.fromEntries(G.map((g) => [g.handle, g.oncekiHtml])), 'baska-urun': '<p>6,35 cm</p>' };
  it('başka ürüne dokunmaz: tam 4 yazım, yalnız bu dört handle; kütükte ÖNCESİ HTML', async () => {
    const s = sahte(canli);
    const oz = await degistirCalistir(G, s.dep, { uygula: true });
    expect(oz).toMatchObject({ taranan: 4, yazildi: 4, atlandi: 0, hata: 0 });
    expect(s.yazilan).toHaveLength(4);
    expect(s.yazilan).not.toContain('gid://shopify/Product/4');
    for (const k of s.kutuk) { expect(k.kip).toBe('olcu'); expect(k.onceHtml).toBe(canli[k.handle as keyof typeof canli]); }
  });
  it('dry-run varsayılanında yaz HİÇ çağrılmaz', async () => {
    const s = sahte(canli);
    expect(await degistirCalistir(G, s.dep, { uygula: false })).toMatchObject({ yazilacak: 4, yazildi: 0 });
    expect(s.yazilan).toEqual([]);
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazmaz', async () => {
    const s = sahte(canli, true);
    expect(await degistirCalistir(G, s.dep, { uygula: true })).toMatchObject({ yazildi: 0, atlandi: 4 });
    expect(s.yazilan).toEqual([]);
  });
  it('ikinci koşu (canlı = yeni) hiçbir şey yazmaz', async () => {
    const s = sahte(Object.fromEntries(G.map((g) => [g.handle, g.yeniHtml])));
    expect(await degistirCalistir(G, s.dep, { uygula: true })).toMatchObject({ degisiklikYok: 4, yazildi: 0 });
  });
  it('betik yalnız descriptionHtml yazar (başlık/handle/barkod alanı mutasyonda yok)', () => {
    const b = readFileSync(path.join(KOK, 'scripts', 'aciklama-degistir.mts'), 'utf8');
    expect(b).toContain('{ p: { id, descriptionHtml: html } }');
    expect(b.split("'mutation(").length - 1).toBe(1);
    expect(b).not.toMatch(/barcode|productVariant|title\s*:/);
  });
});
