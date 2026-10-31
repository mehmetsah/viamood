/**
 * #994831 · DALGA 7 · ADIM 1 · AÇIKLAMA BAŞINDAKİ İÇ BAŞLIKLAR.
 *
 * Ölçüm (31 Eki 2026, 505 aktif ürün, h1–h6/p/div/li, span parçaları birleştirilerek): yalnız
 * `smartduo-iki-bolmeli-camasir-sepeti-84lt-2` açıklaması şu iç diziyle BAŞLIYOR —
 *   h2 «Ürün Başlığı» · p ürün adı satırı · h2 «Shopify Ürün Açıklaması» — ardından asıl açıklama (h3 ürün adı + gövde).
 * Bu, kuyruk kalıbına (aciklama-pazar-blok) girmeyen ayrı bir sınıf. Aynı ailenin baştaki biçimleri de kapsandı
 * («Trendyol Ürün Adı» + ad · «Ürün Etiketleri (SEO)» + liste · «Trendyol (Ürün) Açıklaması» işaret başlığı);
 * ölçümde bunların başta duran örneği 0.
 *
 * KAPI — baştaki dizi ancak HEPSİ sağlanırsa silinir (dar; gevşetilmez):
 *   1. yalnız açıklamanın EN BAŞINDAN itibaren ardışık öğeler (arada yalnız boşluk); ilk iç olmayan öğede durulur,
 *      sonrasındaki hiçbir şeye dokunulmaz,
 *   2. «Ürün Başlığı» / «Trendyol Ürün Adı» → ardından TEK ad satırı (aciklama-pazar-blok · adGovdesiMi),
 *      «Ürün Etiketleri (SEO)» / «SEO Etiketleri» → ardından TEK anahtar sözcük listesi (seoListesiMi),
 *      «Shopify Ürün Açıklaması» / «Trendyol (Ürün) Açıklaması» → yalnız işaret başlığı, gövdesi asıl açıklamadır,
 *   3. başlık tanınıp gövdesi kapıdan geçmezse ürün ATLANIR (şüphe),
 *   4. silme sonrası en az bir paragraf kalır; düz metin = öncesinin düz metninden silinen dizinin metni BAŞTAN
 *      çıkarılmış hâli (METİN KAPISI); dönüşüm idempotent.
 * Metin karşılaştırması `duzMetin` ile yapılır: `<span>Ürün </span><span>Başlığı</span>` → «Ürün Başlığı».
 * A2 (aciklama-baslik-tekrar) ile ilişki: bu kapı yalnız iç başlığın ALTINDAKİ ad satırını alır; gövdenin başındaki
 * ad paragrafları A2'nin işidir. A2 baştaki h2'yi görünce hiçbir şeye dokunmaz; iki dönüşüm birlikte idempotenttir.
 *
 * Çivi: tests/aciklama-bas-blok.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { adGovdesiMi, seoListesiMi } from './aciklama-pazar-blok';

export const BAS_BLOKLAR = {
  ad: ['Ürün Başlığı', 'Trendyol Ürün Adı'],
  seo: ['Ürün Etiketleri (SEO)', 'SEO Etiketleri'],
  isaret: ['Shopify Ürün Açıklaması', 'Trendyol Ürün Açıklaması', 'Trendyol Açıklaması'],
} as const;
type Tur = keyof typeof BAS_BLOKLAR;

export function basTuru(metin: string): Tur | null {
  for (const t of Object.keys(BAS_BLOKLAR) as Tur[]) if ((BAS_BLOKLAR[t] as readonly string[]).includes(metin)) return t;
  return null;
}

type Oge = { metin: string; bas: number; son: number };
const OGE = /<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;

/** Açıklamanın başından itibaren ARDIŞIK h1–h6/p öğeleri; araya başka içerik girince durur. */
function bastakiOgeler(html: string): Oge[] {
  const out: Oge[] = [];
  let beklenen = 0;
  for (const m of html.matchAll(OGE)) {
    if (html.slice(beklenen, m.index).trim() !== '') break;
    out.push({ metin: duzMetin(m[2] ?? ''), bas: m.index ?? 0, son: (m.index ?? 0) + m[0].length });
    beklenen = (m.index ?? 0) + m[0].length;
  }
  return out;
}

export type BasDizi = { son: number; silinen: string[]; turler: Tur[] } | { yok: true } | { supheli: string };

export function basDiziBul(html: string, baslik: string): BasDizi {
  const og = bastakiOgeler(html);
  const turler: Tur[] = [];
  let j = 0;
  while (j < og.length) {
    const t = basTuru(og[j]!.metin);
    if (!t) break;
    if (turler.includes(t)) return { supheli: `«${og[j]!.metin}» iki kez geçiyor` };
    turler.push(t);
    const g = og[j + 1]?.metin;
    if (t === 'ad') {
      if (g === undefined || !adGovdesiMi(g, baslik)) return { supheli: `«${og[j]!.metin}» altındaki satır ürün adı değil` };
      j += 2;
    } else if (t === 'seo') {
      if (g === undefined || !seoListesiMi(g)) return { supheli: `«${og[j]!.metin}» altındaki satır anahtar sözcük listesi değil` };
      j += 2;
    } else j += 1;
  }
  if (!j) return { yok: true };
  return { son: og[j - 1]!.son, silinen: og.slice(0, j).map((o) => o.metin), turler };
}

export function basSoy(html: string, baslik: string): string {
  const d = basDiziBul(html, baslik);
  return 'son' in d ? html.slice(d.son).replace(/^\s+/, '') : html;
}

/** METİN KAPISI — bağımsız beklenti: öncesinin düz metninden silinen dizinin metni BAŞTAN çıkarılır. */
export function beklenenDuzMetin(onceHtml: string, silinen: string[]): string | null {
  const t = duzMetin(onceHtml), bas = silinen.join(' ');
  if (!t.startsWith(bas)) return null;
  return t.slice(bas.length).trim();
}

export type Karar =
  | { durum: 'soyulacak'; html: string; silinen: string[]; turler: Tur[]; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function karar(baslik: string, html: string, donustur: (h: string, b: string) => string = basSoy): Karar {
  const d = basDiziBul(html, baslik);
  if ('yok' in d) return { durum: 'degisiklik-yok', sebep: 'başta iç başlık yok' };
  if ('supheli' in d) return { durum: 'atlandi', sebep: `şüphe: ${d.supheli} — yazılmadı` };
  const yeni = donustur(html, baslik);
  if (!/<p[^>]*>[\s\S]*?<\/p>/.test(yeni)) return { durum: 'atlandi', sebep: 'silme sonrası paragraf kalmıyor — yazılmadı' };
  const beklenen = beklenenDuzMetin(html, d.silinen);
  if (beklenen === null || duzMetin(yeni) !== beklenen) return { durum: 'atlandi', sebep: 'metin kapısı: düz metin beklenenden farklı — yazılmadı' };
  if (donustur(yeni, baslik) !== yeni) return { durum: 'atlandi', sebep: 'idempotent değil — yazılmadı' };
  return { durum: 'soyulacak', html: yeni, silinen: d.silinen, turler: d.turler, onceBayt: Buffer.byteLength(html), sonraBayt: Buffer.byteLength(yeni) };
}

export type Urun = { id: string; handle: string; baslik: string; html: string };
export type KutukSatiri = { handle: string; durum: 'soyulacak' | 'soyuldu' | 'degisiklik-yok' | 'atlandi' | 'hata'; sebep?: string; silinen?: string[]; turler?: Tur[]; onceBayt?: number; sonraBayt?: number; onceHtml?: string };
export type Ozet = { taranan: number; soyulacak: number; soyuldu: number; degisiklikYok: number; atlandi: number; hata: number };

/** `uygula` false iken `yaz` HİÇ çağrılmaz. Yazmadan önce ürün YENİDEN okunur; değiştiyse yazılmaz. */
export async function blokCalistir(
  urunler: Iterable<Urun> | AsyncIterable<Urun>,
  dep: { oku: (id: string) => Promise<string | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean; donustur?: (h: string, b: string) => string },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, soyulacak: 0, soyuldu: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for await (const u of urunler) {
    oz.taranan++;
    try {
      const k = karar(u.baslik, u.html, sec.donustur);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; continue; } // temiz ürün kütüğü şişirmesin
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const olcu = { silinen: k.silinen, turler: k.turler, onceBayt: k.onceBayt, sonraBayt: k.sonraBayt };
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
