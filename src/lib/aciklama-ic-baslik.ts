/**
 * #994831 / #994995 sınıfı · POLA AÇIKLAMALARINDA MÜŞTERİYE GÖRÜNEN İÇ BAŞLIKLAR.
 *
 * Ölçüm (31 Eki 2026, 505 aktif ürün): 54 Pola ürününün açıklamasında içerik hazırlama
 * şablonundan kalan iki etiket paragrafı müşteriye basılıyor — `<p>Ürün Başlığı</p>` ve
 * `<p>Shopify Ürün Açıklaması</p>` — ve 3 üründe cümle başında "Görsellerde doğrulandığı üzere".
 *
 * Yalnız bu üç kalıp çıkarılır; başka hiçbir metne dokunulmaz:
 *   1. tam olarak `<p>Ürün Başlığı</p>` paragrafı (içinde başka metin varsa DOKUNULMAZ),
 *   2. tam olarak `<p>Shopify Ürün Açıklaması</p>` paragrafı,
 *   3. "Görsellerde doğrulandığı üzere " ifadesi YALNIZ cümle başındaysa; ardından gelen ilk
 *      harf büyütülür ("…üzere üründe dikişsiz…" → "Üründe dikişsiz…"). Cümle içinde geçerse
 *      dokunulmaz (bilgiyi bozmadan düşürmenin güvenli kuralı yok).
 *
 * METİN KAPISI: dönüşüm HTML üzerinde yapılır; beklenen düz metin ise ayrı bir yoldan,
 * öncesinin DÜZ METNİ üzerinde aynı üç kural uygulanarak hesaplanır. İkisi birebir aynı
 * değilse ürün yazılmaz. Böylece HTML dönüşümündeki bir hata metni sessizce bozamaz.
 *
 * Çivi: tests/aciklama-ic-baslik.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';

const IFADE = 'Görsellerde doğrulandığı üzere ';
const BUYUK: Record<string, string> = { i: 'İ', ı: 'I', ç: 'Ç', ğ: 'Ğ', ö: 'Ö', ş: 'Ş', ü: 'Ü' };
const buyut = (c: string) => BUYUK[c] ?? c.toUpperCase();

export const KALIPLAR = {
  urunBasligi: /<p>\s*Ürün Başlığı\s*<\/p>/g,
  shopifyAciklama: /<p>\s*Shopify Ürün Açıklaması\s*<\/p>/g,
  /** Cümle başı: paragraf başı (`>`) ya da nokta/ünlem/soru + boşluk sonrası. */
  gorsellerde: /(^|>|[.!?]\s+)Görsellerde doğrulandığı üzere (\p{L})/gu,
} as const;

export function kalipSayilari(html: string) {
  return {
    urunBasligi: (html.match(KALIPLAR.urunBasligi) ?? []).length,
    shopifyAciklama: (html.match(KALIPLAR.shopifyAciklama) ?? []).length,
    gorsellerde: (html.match(KALIPLAR.gorsellerde) ?? []).length,
    gorsellerdeHerhangi: html.split(IFADE.trim()).length - 1,
  };
}

/** HTML dönüşümü — üç kalıbı çıkarır. */
export function icBaslikSoy(html: string): string {
  return html
    .replace(KALIPLAR.urunBasligi, '')
    .replace(KALIPLAR.shopifyAciklama, '')
    .replace(KALIPLAR.gorsellerde, (_m, onek: string, harf: string) => onek + buyut(harf));
}

/** METİN KAPISININ bağımsız beklentisi — öncesinin DÜZ METNİ üzerinde aynı kurallar. */
export function beklenenDuzMetin(onceHtml: string): string {
  const parcalar = [...onceHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => duzMetin(m[1] ?? ''));
  const etiketSayisi = parcalar.filter((p) => p === 'Ürün Başlığı' || p === 'Shopify Ürün Açıklaması').length;
  let t = duzMetin(onceHtml);
  // Etiket paragrafları düz metinde tek başına kelime öbeği olarak durur; tam olarak o kadar kez düşür.
  for (let i = 0; i < etiketSayisi; i++) {
    const once = t;
    t = t.replace(/(^| )(Ürün Başlığı|Shopify Ürün Açıklaması)( |$)/, (_m, a: string, _e: string, b: string) => (a && b ? ' ' : ''));
    if (t === once) break;
  }
  return t.replace(/(^|[.!?] )Görsellerde doğrulandığı üzere (\p{L})/gu, (_m, onek: string, harf: string) => onek + buyut(harf)).trim();
}

export type Karar =
  | { durum: 'soyulacak'; html: string; once: ReturnType<typeof kalipSayilari>; sonra: ReturnType<typeof kalipSayilari>; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok' }
  | { durum: 'atlandi'; sebep: string };

export function karar(html: string, donustur: (h: string) => string = icBaslikSoy): Karar {
  const once = kalipSayilari(html);
  if (once.urunBasligi + once.shopifyAciklama + once.gorsellerde === 0) return { durum: 'degisiklik-yok' };
  const yeni = donustur(html);
  if (duzMetin(yeni) !== beklenenDuzMetin(html)) return { durum: 'atlandi', sebep: 'metin kapısı: düz metin beklenenden farklı — yazılmadı' };
  const sonra = kalipSayilari(yeni);
  if (sonra.urunBasligi + sonra.shopifyAciklama + sonra.gorsellerde !== 0) return { durum: 'atlandi', sebep: 'kalıp sonrası da duruyor — yazılmadı' };
  if (donustur(yeni) !== yeni) return { durum: 'atlandi', sebep: 'idempotent değil — yazılmadı' };
  return { durum: 'soyulacak', html: yeni, once, sonra, onceBayt: Buffer.byteLength(html), sonraBayt: Buffer.byteLength(yeni) };
}

export type Urun = { id: string; handle: string; html: string };
export type KutukSatiri = { handle: string; durum: 'soyulacak' | 'soyuldu' | 'degisiklik-yok' | 'atlandi' | 'hata'; sebep?: string; once?: object; onceBayt?: number; sonraBayt?: number; onceHtml?: string };
export type Ozet = { taranan: number; soyulacak: number; soyuldu: number; degisiklikYok: number; atlandi: number; hata: number };

/** `uygula` false iken `yaz` HİÇ çağrılmaz. Yazmadan önce ürün YENİDEN okunur; değiştiyse yazılmaz. */
export async function icBaslikCalistir(
  urunler: Iterable<Urun> | AsyncIterable<Urun>,
  dep: { oku: (id: string) => Promise<string | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean; donustur?: (h: string) => string },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, soyulacak: 0, soyuldu: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for await (const u of urunler) {
    oz.taranan++;
    try {
      const k = karar(u.html, sec.donustur);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ handle: u.handle, durum: 'degisiklik-yok' }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const olcu = { once: k.once, onceBayt: k.onceBayt, sonraBayt: k.sonraBayt };
      if (!sec.uygula) { oz.soyulacak++; dep.kutuk({ handle: u.handle, durum: 'soyulacak', ...olcu }); continue; }
      if ((await dep.oku(u.id)) !== u.html) { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: 'okuma ile yazma arasında açıklama değişti — yazılmadı' }); continue; }
      const r = await dep.yaz(u.id, k.html);
      if (!r.ok) { oz.hata++; dep.kutuk({ handle: u.handle, durum: 'hata', sebep: r.hata, ...olcu }); continue; }
      oz.soyuldu++; dep.kutuk({ handle: u.handle, durum: 'soyuldu', ...olcu, onceHtml: u.html });
    } catch (e) {
      oz.hata++; dep.kutuk({ handle: u.handle, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
