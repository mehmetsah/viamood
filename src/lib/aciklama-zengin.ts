/**
 * #994831 · AÇIKLAMA ZENGİNLEŞTİRME (dalga 10) — zayıf açıklamaya ürünün KENDİ verisinden «Teknik Bilgiler» tablosu eklenir.
 * Koordinasyon kararı (md.46, 5 Kas 2026): SSS tıkanıklığı açıklama yoksunluğunda; açıklama ürünün kendi verisinden
 * zenginleşir, sonra SSS yazılır. Uydurma yok (md.52).
 *
 * Girdi satırı (veri/994831-aciklama-dalga10.jsonl) aciklama-ekle.ts dalga 2 biçimindedir (mevcut KORUNUR, ek SONA):
 *   { handle, baslik, mevcutHtml, ekHtml, hedefHtml, eslem[{bolum:'Teknik Bilgiler', metin:'Anahtar: değer'}], satirlar[] }
 * Yazma yolu: scripts/aciklama-ekle.mts (kapıları + aciklamaYazKapisi aynen). Bu modül VERİNİN kaynak kapısıdır.
 *
 * KAYNAK KAPISI — her satır ancak HEPSİ sağlanırsa geçer:
 *   1. kaynak türü: başlık · açıklama · etiket · eş model kodlu/eş barkodlu kendi ürünümüz · ürünün kendi görseli. Başka yer YOK,
 *   2. alıntı, kaynak alanın düz metninde BİREBİR geçer (görselde: medya kimliği ürünün kendi medyasında olmalı),
 *   3. değer alıntıdan kurulur: değerin her sayısı alıntıda aynen, her sözcüğü (≥3 harf) alıntıdaki bir sözcüğün başı —
 *      alıntıda olmayan sayı/sözcük yazılamaz (tek harfler × · x gibi ayraç sayılır),
 *   4. değer ve anahtarda kaçamak («yaklaşık» · «genellikle» · «muhtemelen» · «~»), pazarlama şişirmesi, satış/kargo/iade
 *      sözcüğü ve yer tutucu (sss-yer-tutucu.ts) YOK,
 *   5. eş ürün kaynağı yalnız eş barkod ya da başlıkta aynı model kodu (ASR-xxxx) taşıyan kendi ürünümüzdür.
 * ÜRÜN KAPISI: mevcut açıklamada tablo yok (ikinci tablo kurulmaz) · ≥ 3 satır · anahtarlar tekil · ek = tabloHtml(satirlar).
 *
 * Çivi: tests/aciklama-zengin.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { yerTutucuBul } from './sss-yer-tutucu';
import { YASAK_SOZ } from './aciklama-ekle';

export type ZTur = 'baslik' | 'aciklama' | 'etiket' | 'es-urun' | 'urun-gorseli';
export type ZSatir = { anahtar: string; deger: string; kaynak: { tur: ZTur; alan: string; alinti: string } };
export type ZEsUrun = { title: string; descriptionHtml: string; barkodlar: string[] };
export type ZKaynak = { handle: string; title: string; descriptionHtml: string; tags: string[]; medya: string[]; barkodlar: string[]; esUrun: Record<string, ZEsUrun> };

const kucuk = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
const kac = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const belirtecler = (s: string) => kucuk(s).match(/\d+(?:[.,]\d+)?|\p{L}+/gu) ?? [];
const sayi = (t: string) => t.replace(',', '.');
const MODEL = /ASR[- ]?\d{2}[- ]?\d{2}/gi;
const modelKodlari = (s: string) => new Set((s.match(MODEL) ?? []).map((x) => x.toUpperCase().replace(/[- ]/g, '')));

export const KACAMAK = /yaklaşık|genellikle|muhtemelen|tahminen|civarı|~/;
export const SISIRME = /muhteşem|eşsiz|en kaliteli|mükemmel|harika|kusursuz|benzersiz|olağanüstü|bir numara/;
const SATIS = /ücretsiz|fiyat|indirim|kampanya|stok|sipariş/;

/** Değerin alıntıda karşılığı olmayan belirteçleri (boş dizi = değer alıntıdan kurulmuş). */
export function alintidaOlmayan(deger: string, alinti: string): string[] {
  const a = belirtecler(alinti);
  return belirtecler(deger).filter((t) => {
    if (t.length === 1 && !/\d/.test(t)) return false;
    if (/^\d/.test(t)) return !a.some((x) => sayi(x) === sayi(t));
    return !a.some((x) => x === t || (t.length >= 3 && x.startsWith(t)));
  });
}

/** Satırın kaynak alanının düz metni; görselde null (alıntı ürünün kendi medyasıyla bağlanır). */
export function kaynakMetni(k: ZKaynak, s: ZSatir): string | null {
  switch (s.kaynak.tur) {
    case 'baslik': return k.title;
    case 'aciklama': return duzMetin(k.descriptionHtml);
    case 'etiket': return k.tags.join(' | ');
    case 'es-urun': { const e = k.esUrun[s.kaynak.alan]; return e ? `${e.title} ${duzMetin(e.descriptionHtml)}` : ''; }
    default: return null;
  }
}

export function esUrunBagli(k: ZKaynak, alan: string): boolean {
  const e = k.esUrun[alan];
  if (!e || alan === k.handle) return false;
  if (e.barkodlar.some((b) => b && k.barkodlar.includes(b))) return true;
  const m = modelKodlari(k.title);
  return [...modelKodlari(e.title)].some((x) => m.has(x));
}

export function satirKapisi(k: ZKaynak, s: ZSatir): { ok: true } | { ok: false; sebep: string } {
  const { tur, alan, alinti } = s.kaynak;
  if (!['baslik', 'aciklama', 'etiket', 'es-urun', 'urun-gorseli'].includes(tur)) return { ok: false, sebep: `izinsiz kaynak türü: ${tur}` };
  if (!alinti.trim() || !s.deger.trim() || !s.anahtar.trim()) return { ok: false, sebep: 'boş anahtar / değer / alıntı' };
  if (!/^[\p{L} ()]{2,40}$/u.test(s.anahtar)) return { ok: false, sebep: `anahtar biçimi: ${s.anahtar}` };
  if (tur === 'urun-gorseli') { if (!k.medya.includes(alan)) return { ok: false, sebep: `görsel ürünün kendi medyasında değil: ${alan}` }; }
  else {
    if (tur === 'es-urun' && !esUrunBagli(k, alan)) return { ok: false, sebep: `eş ürün eş barkod / eş model kodu taşımıyor: ${alan}` };
    if (!(kaynakMetni(k, s) ?? '').includes(alinti)) return { ok: false, sebep: `alıntı kaynakta birebir yok: ${alinti.slice(0, 60)}` };
  }
  const yok = alintidaOlmayan(s.deger, alinti);
  if (yok.length) return { ok: false, sebep: `değerde alıntıda olmayan belirteç: ${yok.join(', ')}` };
  const m = kucuk(`${s.anahtar} ${s.deger}`);
  if (KACAMAK.test(m)) return { ok: false, sebep: 'kaçamak ifade' };
  if (SISIRME.test(m)) return { ok: false, sebep: 'pazarlama şişirmesi' };
  if (YASAK_SOZ.test(m) || SATIS.test(m)) return { ok: false, sebep: 'yasak sözcük (satış / kargo / iade / pazar yeri)' };
  if (yerTutucuBul(`${s.anahtar}: ${s.deger}`).length) return { ok: false, sebep: 'yer tutucu / iç not' };
  return { ok: true };
}

/** Ekin tek doğru HTML çıktısı — dalga 2 «Teknik Bilgiler» düzeni. */
export function tabloHtml(satirlar: ZSatir[]): string {
  return '<h2>Teknik Bilgiler</h2><table><tbody><tr><th>Özellik</th><th>Bilgi</th></tr>'
    + satirlar.map((s) => `<tr><td>${kac(s.anahtar)}</td><td>${kac(s.deger)}</td></tr>`).join('') + '</tbody></table>';
}

export type ZGiris = { handle: string; baslik: string; mevcutHtml: string; ekHtml: string; hedefHtml: string; eslem: Array<{ bolum: 'Teknik Bilgiler'; metin: string }>; satirlar: ZSatir[] };

export function urunKapisi(k: ZKaynak, satirlar: ZSatir[]): { ok: true } | { ok: false; sebep: string } {
  if (/<table\b/i.test(k.descriptionHtml)) return { ok: false, sebep: 'açıklamada zaten tablo var — ikinci tablo kurulmaz' };
  if (satirlar.length < 3) return { ok: false, sebep: `${satirlar.length} satır — en az 3 kaynaklı satır gerekir` };
  if (new Set(satirlar.map((s) => kucuk(s.anahtar))).size !== satirlar.length) return { ok: false, sebep: 'anahtar tekrarı' };
  for (const s of satirlar) { const r = satirKapisi(k, s); if (!r.ok) return { ok: false, sebep: `${s.anahtar}: ${r.sebep}` }; }
  return { ok: true };
}

/** Kapı geçerse yazma girdisini kurar; geçmezse sebebiyle hata fırlatır (veri üretimi şüphede DURUR). */
export function zenginGiris(k: ZKaynak, satirlar: ZSatir[]): ZGiris {
  const r = urunKapisi(k, satirlar);
  if (!r.ok) throw new Error(`${k.handle}: ${r.sebep}`);
  const ekHtml = tabloHtml(satirlar);
  return {
    handle: k.handle, baslik: k.title, mevcutHtml: k.descriptionHtml, ekHtml, hedefHtml: k.descriptionHtml + ekHtml,
    eslem: satirlar.map((s) => ({ bolum: 'Teknik Bilgiler' as const, metin: `${s.anahtar}: ${s.deger}` })), satirlar,
  };
}
