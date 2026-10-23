/**
 * #994995 · AÇIKLAMA SINIF SOYMA ÇİVİSİ.
 * Dry-run kapısı, metin kapısı (düz metin birebir), idempotans, boş sarmalayıcı temizliği,
 * görünür kalıntıda dokunmama ve hatalı üründe sürecin sürmesi.
 * MUTASYON: src/lib/aciklama-sinif-soy.ts içindeki `duzMetin(sonra) !== duzMetin(html)` METİN KAPISI
 * kaldırılırsa "metin değişen ürün atlanır" iddiaları KIRILIR (bozuk dönüştürücü yazmaya ulaşır).
 */
import { describe, expect, it } from 'vitest';
import { duzMetin, gidisDonus, sinifSoyCalistir, soy, urunKarar, type KutukSatiri, type Urun } from '../src/lib/aciklama-sinif-soy';

// Canlı bir ürün açıklamasıyla aynı biçim (el-yapimi-linea-model-fil-ayagi-cam-vazo, 23 Eki 2026, kısaltıldı).
const VAZO = '<p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">Sade ve modern çizgileriyle Linea model vazomuz.</p>\n'
  + '<p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">✔ %100 el yapımı cam<br>\n✔ Sade çizgili (linea) tasarım</p>\n';
const TABLOLU = '<div class="overflow-x-auto w-full px-2 mb-6"><table class="min-w-full border-collapse text-sm"><thead class="border-b-0.5">'
  + '<tr><th class="text-text-000 font-bold" scope="col">Özellik</th></tr></thead><tbody><tr><td class="border-t-0.5">20 cm</td></tr></tbody></table></div>'
  + '<p dir="ltr" class="font-claude-response-body">Model kodu: <a href="/x" class="u">P-1</a></p>';

function sahte(hataVer: Record<string, 'firlat' | 'red'> = {}) {
  const yazilan: Array<{ handle: string; html: string }> = [];
  const kutuk: KutukSatiri[] = [];
  return {
    yazilan, kutuk,
    dep: {
      yaz: async (u: Urun, html: string) => {
        if (hataVer[u.handle] === 'firlat') throw new Error('ağ koptu');
        if (hataVer[u.handle] === 'red') return { ok: false as const, hata: 'userErrors: geçersiz' };
        yazilan.push({ handle: u.handle, html });
        return { ok: true as const };
      },
      kutuk: (s: KutukSatiri) => { kutuk.push(s); },
    },
  };
}
const urun = (handle: string, html: string): Urun => ({ id: `gid://shopify/Product/${handle.length}`, handle, html });

describe('soy — yalnız öznitelik/sarmalayıcı, metin dokunulmaz', () => {
  it('gerçek biçimli açıklamada sohbet sınıfları gider, düz metin BİREBİR aynı kalır', () => {
    const s = soy(VAZO);
    expect(s).not.toContain('font-claude-response');
    expect(s).not.toContain('class=');
    expect(duzMetin(s)).toBe(duzMetin(VAZO));
    expect(s).toBe('<p>Sade ve modern çizgileriyle Linea model vazomuz.</p>\n<p>✔ %100 el yapımı cam<br>\n✔ Sade çizgili (linea) tasarım</p>\n');
  });

  it('class · data-* · aria-* · role · tabindex soyulur; href · scope · dir · style KORUNUR', () => {
    const s = soy('<div role="feed" aria-label="x" data-index="0" tabindex="-1" style="color:red" class="a">t</div>' + TABLOLU);
    expect(s).not.toMatch(/\s(class|data-[\w-]+|aria-[\w-]+|role|tabindex)=/);
    expect(s).toContain('style="color:red"');
    expect(s).toContain('href="/x"');
    expect(s).toContain('scope="col"');
    expect(s).toContain('dir="ltr"');
  });

  it('ayrıştır + yaz girdiyi bayt bayt geri verir (bozuk/eşsiz etiket dahil)', () => {
    for (const h of [VAZO, TABLOLU, '<p>a < b ve 5<6</p></span><div><p>kapanmamış', '<!-- not --><br/><img src="a.jpg" alt="x"/>']) {
      expect(gidisDonus(h)).toBe(h);
    }
  });

  it('boş sarmalayıcı div/span düşer; <br> taşıyan div KALIR (görünür satır boşluğu)', () => {
    expect(soy('<p>a</p><div class="x"> </div><span data-x="1"></span><div><div class="y">\n</div></div>')).toBe('<p>a</p>');
    expect(soy('<p>a</p><div class="x"><br></div>')).toBe('<p>a</p><div><br></div>');
  });

  it('yalnız blok çocuklu div açılır; metin taşıyan div ve öznitelikli span AÇILMAZ', () => {
    expect(soy('<div class="w"><p>a</p>\n<ul><li>b</li></ul></div>')).toBe('<p>a</p>\n<ul><li>b</li></ul>');
    expect(soy('<div class="w">düz metin<p>a</p></div>')).toBe('<div>düz metin<p>a</p></div>');
    expect(soy('<p><span class="k">x</span> <span style="font-weight:700">y</span></p>')).toBe('<p>x <span style="font-weight:700">y</span></p>');
  });

  it('idempotans: soy(soy(x)) === soy(x)', () => {
    for (const h of [VAZO, TABLOLU, '<div class="a"><div class="b"><div><p>iç</p></div></div></div>']) {
      expect(soy(soy(h))).toBe(soy(h));
    }
  });
});

describe('urunKarar — kapılar', () => {
  it('sohbet izi yoksa değişiklik yok', () => {
    expect(urunKarar('<p>Temiz açıklama</p>')).toEqual({ durum: 'degisiklik-yok', onceBayt: 23 });
  });

  it('görünür kalıntı (iç not) taşıyan ürüne dokunmaz', () => {
    const k = urunKarar('<p class="font-claude-response-body">Ürün</p><p><strong>Diğer alanlar:</strong> SKU</p>');
    expect(k.durum).toBe('atlandi');
    expect(k.durum === 'atlandi' && k.sebep).toContain('görünür kalıntı');
  });

  it('METİN KAPISI: düz metni değiştiren dönüştürücü → "metin değişiyor, atlandı"', () => {
    const bozuk = (h: string) => soy(h).replace('vazomuz', 'vazo');
    expect(urunKarar(VAZO, bozuk)).toEqual({ durum: 'atlandi', sebep: 'metin değişiyor, atlandı', onceBayt: Buffer.byteLength(VAZO) });
  });

  it('soyulacak bayt = önce − sonra', () => {
    const k = urunKarar(VAZO);
    expect(k.durum).toBe('soyulacak');
    if (k.durum === 'soyulacak') expect(k.soyulanBayt).toBe(k.onceBayt - Buffer.byteLength(k.html));
  });
});

describe('sinifSoyCalistir — toplu akış', () => {
  const liste = () => [urun('vazo', VAZO), urun('tablo', TABLOLU), urun('temiz', '<p>ok</p>'), urun('not', '<p class="a">x</p><p>Kategori meta alanları: …</p>')];

  it('DRY-RUN: yaz HİÇ çağrılmaz, her ürün kütüğe tek satır düşer', async () => {
    const s = sahte();
    const oz = await sinifSoyCalistir(liste(), s.dep, { uygula: false });
    expect(s.yazilan).toHaveLength(0);
    expect(oz).toMatchObject({ taranan: 4, soyulacak: 2, soyuldu: 0, degisiklikYok: 1, atlandi: 1, hata: 0 });
    expect(s.kutuk.map((k) => k.durum)).toEqual(['soyulacak', 'soyulacak', 'degisiklik-yok', 'atlandi']);
  });

  it('UYGULA: soyulmuş HTML yazılır, kütük geri alma için öncesini taşır', async () => {
    const s = sahte();
    const oz = await sinifSoyCalistir(liste(), s.dep, { uygula: true });
    expect(oz.soyuldu).toBe(2);
    expect(s.yazilan.map((y) => y.handle)).toEqual(['vazo', 'tablo']);
    expect(s.yazilan.every((y) => !y.html.includes('class='))).toBe(true);
    expect(s.kutuk.find((k) => k.handle === 'vazo')?.onceHtml).toBe(VAZO);
  });

  it('IDEMPOTANS: yazılan çıktı üzerinde ikinci koşu 0 değişiklik', async () => {
    const s1 = sahte();
    await sinifSoyCalistir(liste(), s1.dep, { uygula: true });
    const ikinci = s1.yazilan.map((y) => urun(y.handle, y.html));
    const s2 = sahte();
    const oz = await sinifSoyCalistir(ikinci, s2.dep, { uygula: true });
    expect(oz).toMatchObject({ soyuldu: 0, degisiklikYok: 2 });
    expect(s2.yazilan).toHaveLength(0);
  });

  it('METİN KAPISI uygula kipinde de geçerli: bozuk dönüştürücü yazmaya ULAŞMAZ', async () => {
    const s = sahte();
    const oz = await sinifSoyCalistir([urun('vazo', VAZO)], s.dep, { uygula: true, donustur: (h) => soy(h).replace(/Sade /g, '') });
    expect(s.yazilan).toHaveLength(0);
    expect(oz.atlandi).toBe(1);
    expect(s.kutuk[0]).toMatchObject({ handle: 'vazo', durum: 'atlandi', sebep: 'metin değişiyor, atlandı' });
  });

  it('hatalı ürün süreci durdurmaz (fırlatan + reddeden yazma)', async () => {
    const s = sahte({ vazo: 'firlat', tablo: 'red' });
    const oz = await sinifSoyCalistir([...liste(), urun('vazo2', VAZO)], s.dep, { uygula: true });
    expect(oz).toMatchObject({ hata: 2, soyuldu: 1 });
    expect(s.yazilan.map((y) => y.handle)).toEqual(['vazo2']);
    expect(s.kutuk.filter((k) => k.durum === 'hata').map((k) => k.sebep)).toEqual(['ağ koptu', 'userErrors: geçersiz']);
  });
});
