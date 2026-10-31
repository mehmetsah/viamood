/**
 * #994831 · A2 · POLA AÇIKLAMALARININ BAŞINDAKİ ÜRÜN ADI TEKRARI.
 *
 * İç başlık temizliğinden (aciklama-ic-baslik) sonra Pola açıklamaları ürün adının iki yazımıyla
 * başlıyor — ör. «Pola Concept … 6'lı Set Asorti | %80 Bambu» ve «Pola Concept … 6'lı Set Asorti» —
 * ardından gövde geliyor. Ürün adı sayfanın başlığında zaten var; bu paragraflar artık.
 *
 * KAPI — bir paragraf ancak HEPSİ sağlanırsa silinir (dar; gevşetilmez):
 *   1. handle `pola-` ile başlar (kapsam yalnız Pola),
 *   2. açıklamanın EN BAŞINDAKİ ardışık paragraflardandır — ilk kapıdan geçemeyen paragrafta durulur,
 *      sonrasındaki hiçbir paragrafa dokunulmaz,
 *   3. ürün başlığıyla sözcük örtüşmesi ≥ ESIK (`|` sonrası SEO eki örtüşmeden düşülür),
 *   4. gövde cümlesi değildir: içinde cümle sonu noktası yok ve çekimli fiil kalıbı yok.
 * Ayrıca: silme sonrası en az bir paragraf kalmalı; düz metin, öncesinin düz metninden yalnız silinen
 * paragrafların metni baştan çıkarılmış hâli olmalı (METİN KAPISI).
 *
 * ESIK ölçümü (31 Eki 2026, 505 aktif ürün, ilk 3 paragraf): Pola'nın iki ad paragrafı başlıkla
 * 0,71–0,92 örtüşüyor; Pola gövde paragrafları 0,24–0,27. Eşik 0,6 iki küme arasında.
 *
 * Çivi: tests/aciklama-baslik-tekrar.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';

export const ESIK = 0.6;
const KUCUK = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
/** Türkçe çekimli fiil ekleri — sözcük sonunda. Geniş tutuldu: şüphede paragraf SİLİNMEZ. */
const FIIL = /[\wçğıöşü]+(?:dır|dir|dur|dür|tır|tir|tur|tür|ar|er|ır|ir|ur|ür)(?![\wçğıöşü])/;

export function sozcukler(s: string): Set<string> {
  return new Set((KUCUK(s).match(/[\wçğıöşü'’]+/g) ?? []).filter((w) => w.length > 1));
}

export function ortusme(paragraf: string, baslik: string): number {
  const p = sozcukler(paragraf.split('|')[0] ?? ''), b = sozcukler(baslik);
  if (!p.size) return 0;
  let n = 0; for (const w of p) if (b.has(w)) n++;
  return n / p.size;
}

/** Tek paragraf ad tekrarı mı? Neden reddedildiğini de döner (rapor için). */
export function adParagrafiMi(metin: string, baslik: string): { evet: boolean; sebep?: string } {
  const on = (metin.split('|')[0] ?? '').trim();
  if (!on) return { evet: false, sebep: 'boş' };
  const o = ortusme(metin, baslik);
  if (o < ESIK) return { evet: false, sebep: `örtüşme ${o.toFixed(2)} < ${ESIK}` };
  if (/[.!?](\s|$)/.test(on.replace(/\d\.\d/g, ''))) return { evet: false, sebep: 'cümle sonu noktası var' };
  if (FIIL.test(KUCUK(on))) return { evet: false, sebep: 'çekimli fiil kalıbı var' };
  return { evet: true };
}

const P = /<p[^>]*>([\s\S]*?)<\/p>/g;

/** Baştaki ardışık ad paragraflarını bulur; ilk kapıdan geçmeyen paragrafta durur. */
export function tekrarlar(html: string, baslik: string): { silinecek: string[]; durma?: { metin: string; sebep: string } } {
  const silinecek: string[] = [];
  let beklenenIndis = 0;
  for (const m of html.matchAll(P)) {
    // Yalnız EN BAŞTAKİ paragraflar: araya başka içerik girmişse dur.
    if (html.slice(beklenenIndis, m.index).trim() !== '') return { silinecek, durma: { metin: '(paragraf dışı içerik)', sebep: 'baş dizisi bitti' } };
    const metin = duzMetin(m[1] ?? '');
    const k = adParagrafiMi(metin, baslik);
    if (!k.evet) return { silinecek, durma: { metin: metin.slice(0, 80), sebep: k.sebep ?? '' } };
    silinecek.push(m[0]);
    beklenenIndis = (m.index ?? 0) + m[0].length;
  }
  return { silinecek };
}

export function tekrarSoy(html: string, baslik: string): string {
  const { silinecek } = tekrarlar(html, baslik);
  let s = html;
  for (const p of silinecek) s = s.replace(p, ''); // baştan sırayla: her biri ilk eşleşme = baştaki
  return s;
}

/** METİN KAPISI — bağımsız beklenti: öncesinin düz metninden silinen paragrafların metni BAŞTAN çıkarılır. */
export function beklenenDuzMetin(onceHtml: string, silinecek: string[]): string | null {
  let t = duzMetin(onceHtml);
  for (const p of silinecek) {
    const m = duzMetin(p);
    if (!t.startsWith(m)) return null;
    t = t.slice(m.length).trim();
  }
  return t;
}

export type Karar =
  | { durum: 'soyulacak'; html: string; silinen: string[]; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function karar(handle: string, baslik: string, html: string, donustur: (h: string, b: string) => string = tekrarSoy): Karar {
  if (!handle.startsWith('pola-')) return { durum: 'degisiklik-yok', sebep: 'kapsam dışı (pola- değil)' };
  const t = tekrarlar(html, baslik);
  if (!t.silinecek.length) return { durum: 'degisiklik-yok', sebep: t.durma ? `ilk paragraf ad değil: ${t.durma.sebep}` : 'paragraf yok' };
  const yeni = donustur(html, baslik);
  if (!/<p[^>]*>[\s\S]*?<\/p>/.test(yeni)) return { durum: 'atlandi', sebep: 'silme sonrası paragraf kalmıyor — yazılmadı' };
  const beklenen = beklenenDuzMetin(html, t.silinecek);
  if (beklenen === null || duzMetin(yeni) !== beklenen) return { durum: 'atlandi', sebep: 'metin kapısı: düz metin beklenenden farklı — yazılmadı' };
  if (donustur(yeni, baslik) !== yeni) return { durum: 'atlandi', sebep: 'idempotent değil — yazılmadı' };
  return { durum: 'soyulacak', html: yeni, silinen: t.silinecek.map(duzMetin), onceBayt: Buffer.byteLength(html), sonraBayt: Buffer.byteLength(yeni) };
}

export type Urun = { id: string; handle: string; baslik: string; html: string };
export type KutukSatiri = { handle: string; durum: 'soyulacak' | 'soyuldu' | 'degisiklik-yok' | 'atlandi' | 'hata'; sebep?: string; silinen?: string[]; onceBayt?: number; sonraBayt?: number; onceHtml?: string };
export type Ozet = { taranan: number; soyulacak: number; soyuldu: number; degisiklikYok: number; atlandi: number; hata: number };

/** `uygula` false iken `yaz` HİÇ çağrılmaz. Yazmadan önce ürün YENİDEN okunur; değiştiyse yazılmaz. */
export async function tekrarCalistir(
  urunler: Iterable<Urun> | AsyncIterable<Urun>,
  dep: { oku: (id: string) => Promise<string | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean; donustur?: (h: string, b: string) => string },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, soyulacak: 0, soyuldu: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for await (const u of urunler) {
    oz.taranan++;
    try {
      const k = karar(u.handle, u.baslik, u.html, sec.donustur);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ handle: u.handle, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const olcu = { silinen: k.silinen, onceBayt: k.onceBayt, sonraBayt: k.sonraBayt };
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
