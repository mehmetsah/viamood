/**
 * #994831 · POLA İÇ BAŞLIK TEMİZLİĞİ ÇİVİSİ.
 * Her kalıp için çıkarılır/yoksa dokunulmaz iddiaları, metin kapısı, cümle içi ifade koruması,
 * dry-run'da 0 yazma ve idempotans.
 * MUTASYON: metin kapısı (`duzMetin(yeni) !== beklenenDuzMetin(html)`) kaldırılırsa bozuk dönüştürücü
 * iddiası; bir kalıp regex'i bozulursa ilgili "çıkarılır" iddiası KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { beklenenDuzMetin, icBaslikCalistir, icBaslikSoy, kalipSayilari, karar, type KutukSatiri } from '../src/lib/aciklama-ic-baslik';
import { duzMetin } from '../src/lib/aciklama-ic-not';

// Canlı Pola açıklamasının biçimi (31 Eki 2026, pola-bambu-erkek-cocuk-arakonc-corap-speed-motorsiklet-6li-set, kısaltıldı).
const POLA = "<p>Ürün Başlığı</p><p>Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet Desenli 6'lı Set Asorti | %80 Bambu</p>"
  + "<p>Shopify Ürün Açıklaması</p><p>Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet 6'lı Set Asorti</p>"
  + '<p>Arakonç modeli bileğin biraz üzerine uzanan yapısıyla günlük kullanım için pratik bir çorap boyudur. Görsellerde doğrulandığı üzere üründe dikişsiz burun, takviyeli topuk ve burun yapısı bulunur.</p>'
  + '<p>Teknik Bilgiler</p><p>İçerik %80 Bambu, %18 Poliamid, %2 Elastan</p>';

describe('kalıplar', () => {
  const s = icBaslikSoy(POLA);
  it('"Ürün Başlığı" paragrafı çıkarılır', () => { expect(s).not.toContain('<p>Ürün Başlığı</p>'); expect(kalipSayilari(s).urunBasligi).toBe(0); });
  it('"Shopify Ürün Açıklaması" paragrafı çıkarılır', () => { expect(s).not.toContain('Shopify Ürün Açıklaması'); });
  it('"Görsellerde doğrulandığı üzere" cümle başında düşer, ilk harf büyür (ü → Ü), bilgi aynen kalır', () => {
    expect(s).not.toContain('Görsellerde doğrulandığı üzere');
    expect(s).toContain('çorap boyudur. Üründe dikişsiz burun, takviyeli topuk ve burun yapısı bulunur.');
  });
  it('ürün bilgisi taşıyan paragraflara dokunulmaz', () => {
    expect(s).toContain("<p>Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet Desenli 6'lı Set Asorti | %80 Bambu</p>");
    expect(s).toContain('<p>İçerik %80 Bambu, %18 Poliamid, %2 Elastan</p>');
  });
  it('NEGATİF: başlık YOKSA hiçbir şey değişmez (değişiklik-yok)', () => {
    const temiz = '<p>Ürün Başlığı olarak bu set seçildi.</p><p>Görsellerde gösterilen renkler.</p>';
    expect(icBaslikSoy(temiz)).toBe(temiz);
    expect(karar(temiz)).toEqual({ durum: 'degisiklik-yok' });
  });
  it('ifade cümle İÇİNDEyse dokunulmaz', () => {
    const ici = '<p>Ürün, Görsellerde doğrulandığı üzere iki renktir.</p>';
    expect(icBaslikSoy(ici)).toBe(ici);
  });
  it('i → İ büyütmesi Türkçe kurala uyar', () => {
    expect(icBaslikSoy('<p>Görsellerde doğrulandığı üzere içerik bambudur.</p>')).toBe('<p>İçerik bambudur.</p>');
  });
});

describe('metin kapısı ve karar', () => {
  it('gerçek kalıpta düz metin bağımsız beklentiyle birebir', () => {
    expect(duzMetin(icBaslikSoy(POLA))).toBe(beklenenDuzMetin(POLA));
    const k = karar(POLA);
    expect(k.durum).toBe('soyulacak');
    if (k.durum === 'soyulacak') expect(k.once).toMatchObject({ urunBasligi: 1, shopifyAciklama: 1, gorsellerde: 1 });
  });
  it('METİN KAPISI: fazladan metin silen dönüştürücü → atlandı', () => {
    const bozuk = (h: string) => icBaslikSoy(h).replace('takviyeli topuk ve ', '');
    expect(karar(POLA, bozuk)).toMatchObject({ durum: 'atlandi' });
  });
  it('idempotans: ikinci geçiş değiştirmez', () => {
    expect(icBaslikSoy(icBaslikSoy(POLA))).toBe(icBaslikSoy(POLA));
  });
});

describe('icBaslikCalistir', () => {
  const sahte = (db: Record<string, string>) => {
    const yazilan: string[] = []; const kutuk: KutukSatiri[] = [];
    return { yazilan, kutuk, dep: {
      oku: async (id: string) => db[id] ?? null,
      yaz: async (id: string, html: string) => { yazilan.push(id); db[id] = html; return { ok: true as const }; },
      kutuk: (s: KutukSatiri) => { kutuk.push(s); },
    } };
  };
  const liste = (db: Record<string, string>) => Object.entries(db).map(([id, html]) => ({ id, handle: id, html }));
  it('DRY-RUN: yaz HİÇ çağrılmaz', async () => {
    const db = { a: POLA, b: '<p>temiz</p>' }; const s = sahte(db);
    const oz = await icBaslikCalistir(liste(db), s.dep, { uygula: false });
    expect(oz).toMatchObject({ taranan: 2, soyulacak: 1, degisiklikYok: 1 }); expect(s.yazilan).toHaveLength(0);
  });
  it('UYGULA: yazar, kütük öncesini taşır; ikinci koşu 0 yazar', async () => {
    const db: Record<string, string> = { a: POLA }; const s = sahte(db);
    expect((await icBaslikCalistir(liste(db), s.dep, { uygula: true })).soyuldu).toBe(1);
    expect(s.kutuk[0]?.onceHtml).toBe(POLA);
    expect((await icBaslikCalistir(liste(db), s.dep, { uygula: true })).soyuldu).toBe(0);
  });
  it('okuma ile yazma arasında değişen ürün yazılmaz', async () => {
    const db: Record<string, string> = { a: POLA }; const s = sahte(db);
    const oz = await icBaslikCalistir([{ id: 'a', handle: 'a', html: POLA + ' ' }], s.dep, { uygula: true });
    expect(oz.atlandi + oz.degisiklikYok + oz.soyuldu).toBe(1); expect(s.yazilan).toHaveLength(0);
  });
});
