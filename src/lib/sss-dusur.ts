/**
 * #994831 · SSS SORU DÜŞÜRME — sss-duzelt.ts'nin kardeşi (Mehmet kararı 1 Kas 2026, md.46 koordinasyon: iki üründe kalan
 * «İade edebilir miyim?» sorusu düşer). Gerekçe: SSS üretim kuralı kargo/iade sorusunu yasaklıyor; 327 SSS'li üründen
 * yalnız 2'sinde kalmış bir kural dışı artık. Politika TEK yerde (iade-ve-teslimat sayfası) durmalı. Cevaptaki değer
 * (14 gün · 10 gün) sitenin politikasıyla TUTARLI — bu acil düzeltme değil, temizlik.
 *
 * SİLME YOK: satır DB'den silinmez, sistemin kendi gizleme alanı `acik=false` yapılır (admin ekranının «açık» kutusu ile
 * aynı yol; vitrin API'si ve metafield senkronu yalnız `acik=true` okur). Geri alma = aynı satırda `acik=true` + senkron.
 *
 * Girdi satırı: { handle, soru, onceCevap, gerekce }
 * KAPI — ürün ancak HEPSİ sağlanırsa yazılır:
 *   1. yalnız KURAL DIŞI soru düşer: soru kargo/teslimat/iade/cayma eksenindedir,
 *   2. açık SSS'te bu soru TAM bir kez var ve cevabı = onceCevap (açıkta yok, kapalıda aynısı varsa değişiklik-yok),
 *   3. yeni açık küme = eski açık küme eksi bu satır; öteki soruların soru/cevap/sıra değerleri bayt bayt aynı, en az 1 soru kalır,
 *   4. ÖNCESİ küme (soru + cevap TAM metin + sıra) kütüğe YAZILMADAN DB'ye yazma koşmaz,
 *   5. yazmadan önce SSS yeniden okunur; değiştiyse yazılmaz. `uygula` false iken yaz/senkron çağrılmaz.
 *
 * Çivi: tests/sss-dusur.test.ts.
 */
import { kucuk } from './sss-eksen';
import type { SssKayit } from './urun-sss';

export type SssSatir = SssKayit & { acik: boolean };
export type SssDusurGiris = { handle: string; soru: string; onceCevap: string; gerekce: string };
/** Türkçe büyük/küçük harf için `kucuk()` ile karşılaştırılır («İade» → «iade»; JS /i bayrağı İ'yi i saymaz). */
export const DUSURULEBILIR = /kargo|teslimat|iade|cayma/;

export type Karar =
  | { durum: 'yazilacak'; yeniAcik: SssKayit[]; sira: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

const kayit = (x: SssSatir): SssKayit => ({ soru: x.soru, cevap: x.cevap, sira: x.sira });

export function karar(g: SssDusurGiris, satirlar: SssSatir[]): Karar {
  if (!DUSURULEBILIR.test(kucuk(g.soru))) return { durum: 'atlandi', sebep: 'soru kural dışı eksende değil (kargo/teslimat/iade/cayma) — düşürülmez' };
  const acik = satirlar.filter((x) => x.acik);
  const es = acik.filter((x) => x.soru === g.soru);
  if (es.length === 0 && satirlar.some((x) => !x.acik && x.soru === g.soru && x.cevap === g.onceCevap)) return { durum: 'degisiklik-yok', sebep: 'soru zaten kapalı' };
  if (es.length !== 1) return { durum: 'atlandi', sebep: `soru açık SSS'te ${es.length} kez geçiyor — yazılmadı` };
  const k = es[0]!;
  if (k.cevap !== g.onceCevap) return { durum: 'atlandi', sebep: 'canlı cevap kütükteki öncesinden farklı — yazılmadı' };
  const yeniAcik = acik.filter((x) => x !== k).map(kayit);
  if (yeniAcik.length !== acik.length - 1 || yeniAcik.length < 1) return { durum: 'atlandi', sebep: 'küme kapısı: tek satırdan fazlası düşüyor ya da hiç soru kalmıyor — yazılmadı' };
  return { durum: 'yazilacak', yeniAcik, sira: k.sira };
}

export type KutukSatiri = {
  handle: string; soru: string;
  durum: 'yazilacak' | 'oncesi-kaydedildi' | 'yazildi' | 'yazildi-senkron-hatasi' | 'degisiklik-yok' | 'atlandi' | 'hata';
  sebep?: string; once?: SssSatir[]; sonraAcik?: SssKayit[]; gerekce?: string;
};
export type Ozet = { taranan: number; yazilacak: number; yazildi: number; senkronHatasi: number; degisiklikYok: number; atlandi: number; hata: number };

export async function dusurCalistir(
  girisler: SssDusurGiris[],
  dep: {
    oku: (handle: string) => Promise<SssSatir[]>;
    gizle: (handle: string, sira: number, soru: string, onceCevap: string) => Promise<void>;
    senkronla: (handle: string, acikKayitlar: SssKayit[]) => Promise<{ ok: true } | { ok: false; hata: string }>;
    kutuk: (s: KutukSatiri) => void;
  },
  sec: { uygula: boolean },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, yazilacak: 0, yazildi: 0, senkronHatasi: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for (const g of girisler) {
    oz.taranan++;
    const tem = { handle: g.handle, soru: g.soru };
    try {
      const once = await dep.oku(g.handle);
      const k = karar(g, once);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ ...tem, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: k.sebep, once }); continue; }
      if (!sec.uygula) { oz.yazilacak++; dep.kutuk({ ...tem, durum: 'yazilacak', once, sonraAcik: k.yeniAcik, gerekce: g.gerekce }); continue; }
      if (JSON.stringify(await dep.oku(g.handle)) !== JSON.stringify(once)) { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: 'okuma ile yazma arasında SSS değişti — yazılmadı', once }); continue; }
      dep.kutuk({ ...tem, durum: 'oncesi-kaydedildi', once, sonraAcik: k.yeniAcik, gerekce: g.gerekce }); // atarsa aşağısı KOŞMAZ
      await dep.gizle(g.handle, k.sira, g.soru, g.onceCevap);
      const s = await dep.senkronla(g.handle, k.yeniAcik);
      if (!s.ok) { oz.senkronHatasi++; dep.kutuk({ ...tem, durum: 'yazildi-senkron-hatasi', sebep: s.hata }); continue; }
      oz.yazildi++; dep.kutuk({ ...tem, durum: 'yazildi', sonraAcik: k.yeniAcik });
    } catch (e) {
      oz.hata++;
      try { dep.kutuk({ ...tem, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) }); } catch { /* kütük yazılamıyorsa yalnız sayaç */ }
    }
  }
  return oz;
}
