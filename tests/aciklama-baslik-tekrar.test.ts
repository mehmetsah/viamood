/**
 * #994831 · A2 · POLA AD TEKRARI ÇİVİSİ.
 * MUTASYON: örtüşme eşiği, fiil kapısı, nokta kapısı, "baştaki ardışık" koşulu ya da metin kapısı
 * kaldırılırsa ilgili iddialar KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { adParagrafiMi, karar, tekrarCalistir, tekrarSoy, type KutukSatiri } from '../src/lib/aciklama-baslik-tekrar';

// Canlı biçim (31 Eki 2026, iç başlık temizliği SONRASI, pola-bambu-erkek-cocuk-arakonc-corap-speed-motorsiklet-6li-set, kısaltıldı)
const BASLIK = "Pola Bambu Erkek Çocuk Arakonç Çorap Speed - Motorsiklet 6'lı SET";
const P1 = "<p>Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet Desenli 6'lı Set Asorti | %80 Bambu</p>";
const P2 = "<p>Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet 6'lı Set Asorti</p>";
const GOVDE = '<p>Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed - Motorsiklet, çocukların günlük kombinlerine sportif bir görünüm kazandıran motorsiklet deseni ile tasarlanmıştır. Üründe dikişsiz burun bulunur.</p><p>Teknik Bilgiler</p>';
const H = 'pola-bambu-erkek-cocuk-arakonc-corap-speed-motorsiklet-6li-set';

describe('kapı', () => {
  it('iki ad paragrafı düşer, gövde birebir kalır', () => {
    expect(tekrarSoy(P1 + P2 + GOVDE, BASLIK)).toBe(GOVDE);
  });
  it('NEGATİF: gövde cümlesine dokunmaz (fiil + nokta)', () => {
    expect(adParagrafiMi('Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed - Motorsiklet, sportif görünüm sunar.', BASLIK).evet).toBe(false);
    expect(tekrarSoy(GOVDE, BASLIK)).toBe(GOVDE);
  });
  it('NEGATİF: tekrar yokken değişmez (değişiklik-yok)', () => {
    expect(karar(H, BASLIK, GOVDE)).toMatchObject({ durum: 'degisiklik-yok' });
  });
  it('düşük örtüşmeli kısa paragraf silinmez (eşik)', () => {
    expect(adParagrafiMi('Okul ve günlük kullanım', BASLIK).evet).toBe(false);
  });
  it('fiilli ama noktasız paragraf silinmez', () => {
    expect(adParagrafiMi("Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet 6'lı Set rahat sarar", BASLIK).evet).toBe(false);
  });
  it('yalnız BAŞTAKİ ardışık paragraflar: gövdeden sonra gelen ad paragrafına dokunulmaz', () => {
    expect(tekrarSoy(GOVDE + P2, BASLIK)).toBe(GOVDE + P2);
  });
  it('noktalı (cümle sonu olan) paragraf silinmez — fiil olmasa bile', () => {
    expect(adParagrafiMi("Pola Concept Bambu Erkek Çocuk Arakonç Çorap Speed Motorsiklet 6'lı Set. Asorti", BASLIK).evet).toBe(false);
  });
  it('açıklama paragraf DIŞI içerikle başlıyorsa (görsel/başlık) hiçbir paragrafa dokunulmaz', () => {
    const h = '<div><img src="a.jpg"></div>' + P1 + GOVDE;
    expect(tekrarSoy(h, BASLIK)).toBe(h);
  });
  it('kapsam: pola- dışı ürüne dokunulmaz', () => {
    expect(karar('forte-plus-x', BASLIK, P1 + P2 + GOVDE)).toMatchObject({ durum: 'degisiklik-yok' });
  });
  it('yalnız ad paragraflarından oluşan açıklama boşaltılmaz', () => {
    expect(karar(H, BASLIK, P1 + P2)).toMatchObject({ durum: 'atlandi' });
  });
});

describe('metin kapısı ve akış', () => {
  it('karar: soyulacak, silinen iki ad metni', () => {
    const k = karar(H, BASLIK, P1 + P2 + GOVDE);
    expect(k.durum).toBe('soyulacak');
    if (k.durum === 'soyulacak') expect(k.silinen).toHaveLength(2);
  });
  it('METİN KAPISI: gövdeden de metin silen dönüştürücü → atlandı', () => {
    const bozuk = (h: string, b: string) => tekrarSoy(h, b).replace('motorsiklet deseni ile ', '');
    expect(karar(H, BASLIK, P1 + P2 + GOVDE, bozuk)).toMatchObject({ durum: 'atlandi' });
  });
  it('idempotans', () => {
    const s = tekrarSoy(P1 + P2 + GOVDE, BASLIK);
    expect(tekrarSoy(s, BASLIK)).toBe(s);
  });
  it('DRY-RUN 0 yazma; UYGULA öncesini kütüğe taşır; ikinci koşu 0', async () => {
    const db: Record<string, string> = { a: P1 + P2 + GOVDE }; const yazilan: string[] = []; const kutuk: KutukSatiri[] = [];
    const dep = { oku: async (id: string) => db[id] ?? null, yaz: async (id: string, h: string) => { yazilan.push(id); db[id] = h; return { ok: true as const }; }, kutuk: (s: KutukSatiri) => { kutuk.push(s); } };
    const u = () => [{ id: 'a', handle: H, baslik: BASLIK, html: db.a! }];
    expect((await tekrarCalistir(u(), dep, { uygula: false })).soyulacak).toBe(1); expect(yazilan).toHaveLength(0);
    expect((await tekrarCalistir(u(), dep, { uygula: true })).soyuldu).toBe(1); expect(kutuk.at(-1)?.onceHtml).toBe(P1 + P2 + GOVDE);
    expect((await tekrarCalistir(u(), dep, { uygula: true })).soyuldu).toBe(0);
  });
});
