/**
 * #994831 · KAYNAKLI AÇIKLAMA UYGULAMA (pilot 5 ürün + dalga 2) — Mehmet kararı, 31 Eki 2026.
 *
 * Girdi satırı (veri/994831-aciklama-pilot.jsonl · veri/994831-aciklama-dalga2.jsonl):
 *   pilot  → { handle, taslakHtml }                       : açıklama BOŞ olan ürüne taslağın kendisi yazılır,
 *   dalga2 → { handle, mevcutHtml, ekHtml, hedefHtml }     : mevcut metin KORUNUR, yeni bilgi SONUNA eklenir.
 * Her satırın cümle→kaynak eşlemesi aynı dosyada; kaynak şartı çivide (tests/aciklama-pilot.test.ts ·
 * tests/aciklama-dalga2.test.ts).
 *
 * KAPI — ürün ancak HEPSİ sağlanırsa yazılır:
 *   1. canlı açıklama BEKLENEN ÖNCESİ ile bayt bayt aynı (pilot: 0 bayt; dalga 2: mevcutHtml). Farklıysa başka
 *      bir tur o ürüne yazmış olabilir → ATLA,
 *   2. yazılacak HTML = öncesi + ek, ve hedefHtml/taslakHtml ile BİREBİR,
 *   3. METİN KAPISI: yeni düz metin = öncesinin düz metni + ekin düz metni (öncesi aynen başta),
 *   4. ek, temizlediğimiz sınıfları geri getirmez: kuyruk iç bloğu (kuyrukBul) · baş iç dizisi (basDiziBul) ·
 *      pazar yeri/SEO/sohbet artığı/kargo-iade sözcükleri YOK,
 *   5. idempotent: canlı zaten hedefse değişiklik-yok.
 *   (dalga 2) KALİTE KAPISI: ≥ 10 kaynaklı satır VE «Teknik Bilgiler»de Ölçek/Malzeme/Paket adedinden biri.
 *
 * Çivi: tests/aciklama-ekle.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { kuyrukBul } from './aciklama-pazar-blok';
import { basDiziBul } from './aciklama-bas-blok';

export type Giris = {
  handle: string; baslik: string;
  taslakHtml?: string; mevcutHtml?: string; ekHtml?: string; hedefHtml?: string;
  eslem?: Array<{ bolum: string; metin: string }>;
};
export const YASAK_SOZ = /trendyol|shopify|\bseo\b|etiketleri \(seo\)|meta alan|bu konuşma|kargo|teslimat|iade|garanti/;
const kucuk = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');

export function oncesi(g: Giris): string { return g.mevcutHtml ?? ''; }
export function ek(g: Giris): string { return g.ekHtml ?? g.taslakHtml ?? ''; }
export function hedef(g: Giris): string { return g.hedefHtml ?? g.taslakHtml ?? ''; }

export function kaliteKapisi(g: Giris): { gecti: boolean; satir: number; teknik: string[] } {
  const e = g.eslem ?? [];
  const teknik = e.filter((x) => x.bolum === 'Teknik Bilgiler' && /^(Ölçek|Malzeme|Paket adedi):\s*\S/.test(x.metin)).map((x) => x.metin);
  return { gecti: e.length >= 10 && teknik.length > 0, satir: e.length, teknik };
}

export type Karar =
  | { durum: 'yazilacak'; html: string; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function karar(g: Giris, canli: string, sec: { kalite?: boolean } = {}): Karar {
  const h = hedef(g), o = oncesi(g), e = ek(g);
  if (!e.trim()) return { durum: 'atlandi', sebep: 'ek boş — yazılmadı' };
  if (canli === h) return { durum: 'degisiklik-yok', sebep: 'zaten yazılı' };
  if (canli !== o) return { durum: 'atlandi', sebep: o === '' ? `açıklama artık boş değil (${Buffer.byteLength(canli)} bayt) — yazılmadı` : 'mevcut açıklama taslaktaki öncesinden farklı — yazılmadı' };
  if (sec.kalite) { const q = kaliteKapisi(g); if (!q.gecti) return { durum: 'atlandi', sebep: `kalite kapısı: ${q.satir} satır, teknik ${q.teknik.length} — ince taslak, yazılmadı` }; }
  const yeni = o + e;
  if (yeni !== h) return { durum: 'atlandi', sebep: 'öncesi + ek, hedef HTML ile birebir değil — yazılmadı' };
  const beklenen = (duzMetin(o) + ' ' + duzMetin(e)).trim();
  if (duzMetin(yeni) !== beklenen || !duzMetin(yeni).startsWith(duzMetin(o))) return { durum: 'atlandi', sebep: 'metin kapısı: düz metin beklenenden farklı — yazılmadı' };
  if (!('yok' in kuyrukBul(yeni, g.baslik)) && 'yok' in kuyrukBul(o, g.baslik)) return { durum: 'atlandi', sebep: 'ek, kuyruk iç bloğu getiriyor — yazılmadı' };
  if (!('yok' in basDiziBul(e, g.baslik))) return { durum: 'atlandi', sebep: 'ek, baş iç dizisi getiriyor — yazılmadı' };
  if (YASAK_SOZ.test(kucuk(duzMetin(e)))) return { durum: 'atlandi', sebep: 'ek yasak sözcük içeriyor — yazılmadı' };
  return { durum: 'yazilacak', html: yeni, onceBayt: Buffer.byteLength(o), sonraBayt: Buffer.byteLength(yeni) };
}

export type Urun = { id: string; handle: string; html: string };
export type KutukSatiri = { handle: string; durum: 'yazilacak' | 'yazildi' | 'degisiklik-yok' | 'atlandi' | 'hata'; sebep?: string; onceBayt?: number; sonraBayt?: number; onceHtml?: string };
export type Ozet = { taranan: number; yazilacak: number; yazildi: number; degisiklikYok: number; atlandi: number; hata: number };

/** `uygula` false iken `yaz` HİÇ çağrılmaz. Yazmadan önce ürün YENİDEN okunur; değiştiyse yazılmaz. */
export async function ekleCalistir(
  girisler: Giris[],
  dep: { bul: (handle: string) => Promise<Urun | null>; oku: (id: string) => Promise<string | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean; kalite?: boolean },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, yazilacak: 0, yazildi: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for (const g of girisler) {
    oz.taranan++;
    try {
      const u = await dep.bul(g.handle);
      if (!u) { oz.atlandi++; dep.kutuk({ handle: g.handle, durum: 'atlandi', sebep: 'aktif ürün bulunamadı' }); continue; }
      const k = karar(g, u.html, { kalite: sec.kalite });
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ handle: g.handle, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: g.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const olcu = { onceBayt: k.onceBayt, sonraBayt: k.sonraBayt };
      if (!sec.uygula) { oz.yazilacak++; dep.kutuk({ handle: g.handle, durum: 'yazilacak', ...olcu }); continue; }
      if ((await dep.oku(u.id)) !== u.html) { oz.atlandi++; dep.kutuk({ handle: g.handle, durum: 'atlandi', sebep: 'okuma ile yazma arasında açıklama değişti — yazılmadı' }); continue; }
      const r = await dep.yaz(u.id, k.html);
      if (!r.ok) { oz.hata++; dep.kutuk({ handle: g.handle, durum: 'hata', sebep: r.hata, ...olcu }); continue; }
      oz.yazildi++; dep.kutuk({ handle: g.handle, durum: 'yazildi', ...olcu, onceHtml: u.html });
    } catch (e) {
      oz.hata++; dep.kutuk({ handle: g.handle, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
