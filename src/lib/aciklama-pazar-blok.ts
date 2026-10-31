/**
 * #994831 · ADIM 1 · AÇIKLAMA SONUNDAKİ PAZAR YERİ İÇ BLOKLARI (Trendyol / SEO).
 *
 * Ölçüm (31 Eki 2026, 505 aktif ürün): 54 Pola açıklaması, müşterinin «Ürün detayları» sekmesinde gördüğü
 * şu iç blokları taşıyor — hepsi açıklamanın SONUNDA, ardışık:
 *   «Ürün Etiketleri (SEO)» (53) / «SEO Etiketleri» (1) + virgüllü anahtar sözcük listesi,
 *   «Trendyol Ürün Adı» (54) + ürün adı,
 *   «Trendyol Ürün Açıklaması» (31) / «Trendyol Açıklaması» (23) + madde (`-` / `•`) paragrafları.
 * Aralarında `____` / `--` ayraç paragrafları olabiliyor.
 *
 * KAPI — kuyruk ancak HEPSİ sağlanırsa silinir (dar; gevşetilmez):
 *   1. ilk blok başlığından açıklamanın SONUNA kadar her paragraf bir bloğa aittir (başlık · gövde · ayraç);
 *      blok dışı TEK paragraf bile varsa (ör. sohbet artığı) ürün ATLANIR,
 *   2. SEO gövdesi tek paragraf: küçük harfli, en az 2 virgül, cümle sonu yok,
 *   3. Trendyol ad gövdesi tek paragraf: ilk sözcüğü ürün başlığının ilk (marka) sözcüğü, en fazla AZAMI_SOZCUK
 *      sözcük, cümle sonu yok, son sözcük çekimli fiil değil. A2'nin 0,6 örtüşme eşiği burada KULLANILMAZ:
 *      Trendyol adı varyant ayrıntısı taşıyor (ölçüm: 11 üründe örtüşme 0,38–0,57); sinyal blok başlığının kendisi,
 *   4. Trendyol açıklama gövdesi: en az 1, yalnız madde paragrafı,
 *   5. her blok türü en fazla bir kez; kuyruk paragraf dışı içerik taşımaz.
 * Ayrıca: önünde en az bir paragraf kalır; düz metin = öncesinin düz metninden silinen kuyruk metni SONDAN
 * çıkarılmış hâli (METİN KAPISI); dönüşüm idempotent. Gövde, «Öne Çıkanlar», «Teknik Bilgiler» kuyruktan
 * ÖNCE durduğu için dokunulmaz — metin kapısı bunu bağımsız ölçer.
 *
 * Çivi: tests/aciklama-pazar-blok.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { AZAMI_SOZCUK, sonSozcukFiilMi } from './aciklama-baslik-tekrar';

export const BLOKLAR = {
  seo: ['Ürün Etiketleri (SEO)', 'SEO Etiketleri'],
  ad: ['Trendyol Ürün Adı'],
  aciklama: ['Trendyol Ürün Açıklaması', 'Trendyol Açıklaması'],
} as const;
type Tur = keyof typeof BLOKLAR;

const KUCUK = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
const AYRAC = /^[_\-–—]{2,}$/;
const MADDE = /^[-•]\s/;

export function blokTuru(metin: string): Tur | null {
  for (const t of Object.keys(BLOKLAR) as Tur[]) if ((BLOKLAR[t] as readonly string[]).includes(metin)) return t;
  return null;
}

export function seoListesiMi(metin: string): boolean {
  return KUCUK(metin) === metin && (metin.match(/,/g) ?? []).length >= 2 && !/[.!?]$/.test(metin);
}

export function adGovdesiMi(metin: string, baslik: string): boolean {
  const s = metin.trim().split(/\s+/).filter((w) => /[\wçğıöşüÇĞİÖŞÜ]/.test(w));
  const marka = KUCUK(baslik).trim().split(/\s+/)[0] ?? '';
  return s.length > 0 && s.length <= AZAMI_SOZCUK && KUCUK(s[0]!) === marka
    && !/[.!?](\s|$)/.test(metin.replace(/\d\.\d/g, '')) && !sonSozcukFiilMi(metin);
}

type Paragraf = { metin: string; bas: number; son: number };
const P = /<p[^>]*>([\s\S]*?)<\/p>/g;

function paragraflar(html: string): Paragraf[] {
  return [...html.matchAll(P)].map((m) => ({ metin: duzMetin(m[1] ?? ''), bas: m.index ?? 0, son: (m.index ?? 0) + m[0].length }));
}

export type Kuyruk = { bas: number; silinen: string[]; turler: Tur[] } | { yok: true } | { supheli: string };

/** Açıklama sonundaki iç blok kuyruğunu bulur. Şüphede `supheli` döner — hiçbir şey silinmez. */
export function kuyrukBul(html: string, baslik: string): Kuyruk {
  const ps = paragraflar(html);
  const i = ps.findIndex((p) => blokTuru(p.metin));
  if (i < 0) return { yok: true };
  if (i === 0) return { supheli: 'blok başlığı açıklamanın ilk paragrafı — önünde içerik kalmıyor' };
  for (let k = i; k < ps.length; k++) {
    const arasi = html.slice(ps[k - 1]!.son, ps[k]!.bas);
    if (arasi.trim() !== '') return { supheli: 'kuyrukta paragraf dışı içerik var' };
  }
  if (html.slice(ps[ps.length - 1]!.son).trim() !== '') return { supheli: 'son paragraftan sonra içerik var' };
  const turler: Tur[] = [];
  let j = i;
  while (j < ps.length) {
    const m = ps[j]!.metin;
    if (AYRAC.test(m)) { j++; continue; }
    const t = blokTuru(m);
    if (!t) return { supheli: `blok dışı paragraf: «${m.slice(0, 60)}»` };
    if (turler.includes(t)) return { supheli: `«${m}» iki kez geçiyor` };
    turler.push(t);
    const g = ps[j + 1]?.metin;
    if (t === 'seo') {
      if (g === undefined || !seoListesiMi(g)) return { supheli: `«${m}» gövdesi anahtar sözcük listesi değil` };
      j += 2;
    } else if (t === 'ad') {
      if (g === undefined || !adGovdesiMi(g, baslik)) return { supheli: `«${m}» gövdesi ürün adı değil` };
      j += 2;
    } else {
      let k = j + 1;
      while (k < ps.length && MADDE.test(ps[k]!.metin)) k++;
      if (k === j + 1) return { supheli: `«${m}» altında madde yok` };
      j = k;
    }
  }
  return { bas: ps[i]!.bas, silinen: ps.slice(i).map((p) => p.metin), turler };
}

export function kuyrukSoy(html: string, baslik: string): string {
  const k = kuyrukBul(html, baslik);
  return 'bas' in k ? html.slice(0, k.bas) : html;
}

/** METİN KAPISI — bağımsız beklenti: öncesinin düz metninden silinen kuyruk metni SONDAN çıkarılır. */
export function beklenenDuzMetin(onceHtml: string, silinen: string[]): string | null {
  const t = duzMetin(onceHtml), kuyruk = silinen.join(' ');
  if (!t.endsWith(kuyruk)) return null;
  return t.slice(0, t.length - kuyruk.length).trim();
}

export type Karar =
  | { durum: 'soyulacak'; html: string; silinen: string[]; turler: Tur[]; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function karar(baslik: string, html: string, donustur: (h: string, b: string) => string = kuyrukSoy): Karar {
  const k = kuyrukBul(html, baslik);
  if ('yok' in k) return { durum: 'degisiklik-yok', sebep: 'iç blok yok' };
  if ('supheli' in k) return { durum: 'atlandi', sebep: `şüphe: ${k.supheli} — yazılmadı` };
  const yeni = donustur(html, baslik);
  if (!/<p[^>]*>[\s\S]*?<\/p>/.test(yeni)) return { durum: 'atlandi', sebep: 'silme sonrası paragraf kalmıyor — yazılmadı' };
  const beklenen = beklenenDuzMetin(html, k.silinen);
  if (beklenen === null || duzMetin(yeni) !== beklenen) return { durum: 'atlandi', sebep: 'metin kapısı: düz metin beklenenden farklı — yazılmadı' };
  if (donustur(yeni, baslik) !== yeni) return { durum: 'atlandi', sebep: 'idempotent değil — yazılmadı' };
  return { durum: 'soyulacak', html: yeni, silinen: k.silinen, turler: k.turler, onceBayt: Buffer.byteLength(html), sonraBayt: Buffer.byteLength(yeni) };
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
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; continue; } // 450+ temiz ürün kütüğü şişirmesin
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
