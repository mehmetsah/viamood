/**
 * #994831 · A2 · POLA AD TEKRARI ÇİVİSİ.
 * MUTASYON: örtüşme eşiği, fiil kapısı, nokta kapısı, "baştaki ardışık" koşulu ya da metin kapısı
 * kaldırılırsa ilgili iddialar KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { adParagrafiMi, AZAMI_SOZCUK, ESIK, karar, sonSozcukFiilMi, tekrarCalistir, tekrarSoy, type KutukSatiri } from '../src/lib/aciklama-baslik-tekrar';

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

describe('ADIM 2 — dört yanlış pozitif (fiil ölçütü SON sözcükte; eşik değişmedi)', () => {
  // Canlı biçim, 31 Eki 2026 (kısaltılmadı). Eski sezgi «Sneaker»/«Super» içindeki -er ekini fiil sanıyordu.
  const DORT: Array<[string, string, string, string]> = [
    ['pola-bambu-erkek-sneaker-corap-duz-renk-siyah-6li-set', "Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı SET", "Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı Set | 40-44 Beden", "Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı Set"],
    ['pola-bambu-kadin-sneaker-corap-duz-renk-6li-set', "Pola Bambu Kadın Sneaker Çorap Düz Renk 6'lı SET", "Pola Bambu Kadın Sneaker Çorap Düz Renk Beyaz 6'lı Set | 36-40 Beden", "Pola Bambu Kadın Sneaker Çorap Düz Renk Beyaz 6'lı Set"],
    ['pola-kiz-bebek-super-girl-kelebek-desenli-dizalti-corap-dikissiz-burun-4lu-set', "Pola Kız Bebek Super Girl Kelebek Desenli Dizaltı Çorap Dikişsiz Burun 4'lü SET", "Pola Kız Bebek Super Girl Kelebek Desenli Dizaltı Çorap Dikişsiz Burun 4'lü Set Pembe &amp; Gri &amp; Beyaz &amp; Lacivert", "Pola Kız Bebek Super Girl Kelebek Desenli Dizaltı Çorap Dikişsiz Burun 4'lü Set"],
    ['pola-kiz-cocuk-super-girl-kelebek-desenli-dizalti-corap-dikissiz-burun-4lu-set', "Pola Kız Çocuk Super Girl Kelebek Desenli Dizaltı Çorap Dikişsiz Burun 4'lü SET", "Pola Kız Çocuk Super Girl Kelebek Desenli Dizaltı Çorap Dikişsiz Burun 4'lü Set Pembe &amp; Gri &amp; Beyaz &amp; Lacivert", "Pola Kız Çocuk Super Girl Kelebek Desenli Dizaltı Çorap Dikişsiz Burun 4'lü Set"],
  ];
  const GOV = '<p>Pola Concept bambu çorap seti, günlük kullanım için tasarlanmıştır. Dikişsiz burun yapısına sahiptir.</p><p>Öne Çıkanlar</p>';
  for (const [h, baslik, a, b] of DORT) {
    it(`${h}: iki ad paragrafı silinir, gövde aynen kalır`, () => {
      const k = karar(h, baslik, `<p>${a}</p><p>${b}</p>` + GOV);
      expect(k).toMatchObject({ durum: 'soyulacak', html: GOV });
    });
  }
  it('Sneaker/Super sözcüğü fiil sayılmaz; son sözcükteki gerçek çekim eki sayılır', () => {
    expect(sonSozcukFiilMi("Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı Set")).toBe(false);
    expect(sonSozcukFiilMi('Pola Kız Bebek Super Girl Kelebek Desenli 4lü Set')).toBe(false);
    expect(sonSozcukFiilMi('Pola Concept çorap günlük kullanım için tasarlanmıştır')).toBe(true);
    expect(sonSozcukFiilMi('Esnek yapısı ayağa uyum sağlar.')).toBe(true);
  });
  it(`güvenlik ağı: ${AZAMI_SOZCUK} sözcükten uzun, noktasız, yüksek örtüşmeli paragraf SİLİNMEZ`, () => {
    const B = "Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı SET";
    const uzun = Array(3).fill("Pola Bambu Erkek Sneaker Çorap Düz Renk Siyah 6'lı Set").join(' ');
    expect(adParagrafiMi(uzun, B)).toMatchObject({ evet: false });
  });
  it('örtüşme eşiği 0,6 DEĞİŞMEDİ', () => { expect(ESIK).toBe(0.6); });
});
