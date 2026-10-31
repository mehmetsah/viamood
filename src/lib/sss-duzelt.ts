/**
 * #994831 · SSS CEVAP DÜZELTME — mevcut bir SSS cevabındaki kaynaksız değeri, ürünün GÜNCEL açıklamasındaki kaynaklı
 * değere çeker (Mehmet kararı 1 Kas 2026: Jada Stitch «Boyutu nedir?» → ürün görselindeki ölçü; soru DÜŞMEZ).
 *
 * İçe aktarma (urun-sss-ice-aktar) mevcut SSS'i bilerek EZMEZ; bu modül o kapıyı gevşetmez, yanına DAR bir kip ekler:
 * tek ürün · tek soru · tek cevap. Soru metni, sıra ve öteki cevaplar bayt bayt aynı kalır.
 *
 * Girdi satırı: { handle, soru, onceCevap, yeniCevap, anahtar, eksen, yasak[], kaynak }
 *   · `anahtar` — açıklamadaki tablo satırının anahtar hücresi («Boyut»). Yeni cevap o satırın DEĞER hücresidir.
 *   · `eksen`   — sss-eksen.ts'deki eksen adı; şart/dışlama «anahtar + cevap» üzerinde aynen uygulanır.
 *
 * KAPI — ürün ancak HEPSİ sağlanırsa yazılır:
 *   1. canlı SSS'te bu soru TAM bir kez var ve cevabı = onceCevap (zaten yeniCevap ise değişiklik-yok),
 *   2. sorun ölçüldü: onceCevap yasak değerlerden en az birini taşır; yeniCevap HİÇBİRİNİ taşımaz,
 *   3. METİN KAPISI: «anahtar yeniCevap» güncel açıklamanın düz metninde BİREBİR geçer (cevabın kendisi de dolayısıyla),
 *   4. EKSEN KAPISI: cevapUygunMu(eksen, «anahtar yeniCevap») — şart + dışlama + genel yasak aynen,
 *   5. yeni küme = eski küme, yalnız bu cevap değişmiş (soru, sıra, öteki satırlar aynı).
 * Yazmadan önce SSS yeniden okunur; değiştiyse yazılmaz. ÖNCESİ küme kütüğe yazılır. `uygula` false iken yaz çağrılmaz.
 *
 * Çivi: tests/sss-duzelt.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { EKSENLER, cevapUygunMu } from './sss-eksen';
import type { SssKayit } from './urun-sss';

export type SssDuzeltGiris = {
  handle: string; soru: string; onceCevap: string; yeniCevap: string;
  anahtar: string; eksen: keyof typeof EKSENLER | string; yasak: string[]; kaynak: string;
};

export type Karar =
  | { durum: 'yazilacak'; yeni: SssKayit[]; sira: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

const ayni = (a: SssKayit[], b: SssKayit[]) => JSON.stringify(a) === JSON.stringify(b);

export function karar(g: SssDuzeltGiris, mevcut: SssKayit[], aciklamaHtml: string): Karar {
  const es = mevcut.filter((k) => k.soru === g.soru);
  if (es.length !== 1) return { durum: 'atlandi', sebep: `soru canlı SSS'te ${es.length} kez geçiyor — yazılmadı` };
  const k = es[0]!;
  if (k.cevap === g.yeniCevap) return { durum: 'degisiklik-yok', sebep: 'cevap zaten yazılı' };
  if (k.cevap !== g.onceCevap) return { durum: 'atlandi', sebep: 'canlı cevap kütükteki öncesinden farklı — yazılmadı' };
  if (!g.yasak.length || !g.yasak.some((y) => g.onceCevap.includes(y))) return { durum: 'atlandi', sebep: 'öncesinde yasak değer geçmiyor — sorun ölçülmedi, yazılmadı' };
  const kalan = g.yasak.filter((y) => g.yeniCevap.includes(y));
  if (kalan.length) return { durum: 'atlandi', sebep: `yeni cevapta yasak değer var: ${kalan.join(', ')} — yazılmadı` };
  const d = duzMetin(aciklamaHtml);
  if (!g.yeniCevap.trim() || !d.includes(`${g.anahtar} ${g.yeniCevap}`)) {
    return { durum: 'atlandi', sebep: 'metin kapısı: yeni cevap güncel açıklamada (anahtarıyla) birebir geçmiyor — yazılmadı' };
  }
  const e = cevapUygunMu(g.eksen, `${g.anahtar} ${g.yeniCevap}`);
  if (!e.ok) return { durum: 'atlandi', sebep: `eksen kapısı: ${e.sebep} — yazılmadı` };
  const yeni = mevcut.map((x) => (x === k ? { ...x, cevap: g.yeniCevap } : { ...x }));
  if (yeni.length !== mevcut.length || yeni.filter((x, i) => !ayni([x], [mevcut[i]!])).length !== 1) {
    return { durum: 'atlandi', sebep: 'küme kapısı: tek cevaptan fazlası değişiyor — yazılmadı' };
  }
  return { durum: 'yazilacak', yeni, sira: k.sira };
}

export type KutukSatiri = {
  handle: string; soru?: string;
  durum: 'yazilacak' | 'yazildi' | 'yazildi-senkron-hatasi' | 'degisiklik-yok' | 'atlandi' | 'hata';
  sebep?: string; once?: SssKayit[]; sonra?: SssKayit[];
};
export type Ozet = { taranan: number; yazilacak: number; yazildi: number; senkronHatasi: number; degisiklikYok: number; atlandi: number; hata: number };

export async function duzeltCalistir(
  girisler: SssDuzeltGiris[],
  dep: {
    mevcutOku: (handle: string) => Promise<SssKayit[]>;
    aciklamaOku: (handle: string) => Promise<string | null>;
    yaz: (handle: string, sira: number, onceCevap: string, yeniCevap: string) => Promise<void>;
    senkronla: (handle: string, kayitlar: SssKayit[]) => Promise<{ ok: true } | { ok: false; hata: string }>;
    kutuk: (s: KutukSatiri) => void;
  },
  sec: { uygula: boolean },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, yazilacak: 0, yazildi: 0, senkronHatasi: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for (const g of girisler) {
    oz.taranan++;
    const tem = { handle: g.handle, soru: g.soru };
    try {
      const html = await dep.aciklamaOku(g.handle);
      if (html === null) { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: 'aktif ürün bulunamadı' }); continue; }
      const once = await dep.mevcutOku(g.handle);
      const k = karar(g, once, html);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ ...tem, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: k.sebep, once }); continue; }
      if (!sec.uygula) { oz.yazilacak++; dep.kutuk({ ...tem, durum: 'yazilacak', once, sonra: k.yeni }); continue; }
      if (!ayni(await dep.mevcutOku(g.handle), once)) { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: 'okuma ile yazma arasında SSS değişti — yazılmadı', once }); continue; }
      await dep.yaz(g.handle, k.sira, g.onceCevap, g.yeniCevap);
      const s = await dep.senkronla(g.handle, k.yeni);
      if (!s.ok) { oz.senkronHatasi++; dep.kutuk({ ...tem, durum: 'yazildi-senkron-hatasi', sebep: s.hata, once, sonra: k.yeni }); continue; }
      oz.yazildi++; dep.kutuk({ ...tem, durum: 'yazildi', once, sonra: k.yeni });
    } catch (e) {
      oz.hata++; dep.kutuk({ ...tem, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
