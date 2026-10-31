/**
 * #994831 · BAŞLIK↔AÇIKLAMA ÇELİŞKİSİ · İKİ AÇIKLAMA DÜZELTMESİ (Mehmet kararı, 31 Eki 2026).
 *
 * Ölçüm: raporlar/994831-celiski-ve-pilot-20261031.md — 505 aktif üründe 3 gerçek çelişki. İkisinde hata
 * AÇIKLAMADA, kanıt açık; yalnız bu ikisi düzeltilir (super-bag başlığı ticari teyit bekliyor — dokunulmaz):
 *   · 100-lt-saklama-kutusu-2li-set: açıklama 3'lü setin metninden kopya. Ana görsel «100 LT x 2 ADET SET».
 *   · kare-4lu-…-cerezlik-235-ml: ilk satır «230 ml»; aynı açıklamada «Ürün Hacmi : 235 ml», kardeş ürün 235 ml.
 *
 * KAPI — ürün ancak HEPSİ sağlanırsa yazılır:
 *   1. handle DUZELTMELER listesinde (başka hiçbir ürüne dokunulmaz),
 *   2. her hedef ifade açıklamada TAM BİR KEZ geçer (0 ya da >1 → şüphe, atla),
 *   3. METİN KAPISI: yeni düz metin = eski düz metinde YALNIZ hedef ifadelerin düz metni değişmiş hâli,
 *   4. idempotent: düzeltmelerin hepsi zaten uygulanmışsa değişiklik-yok; yarım uygulanmışsa atla.
 * Başlık, handle ve açıklamanın geri kalanı DEĞİŞMEZ.
 *
 * Çivi: tests/aciklama-duzeltme.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';

export type Duzeltme = { eski: string; yeni: string; kanit: string };
export const DUZELTMELER: Record<string, Duzeltme[]> = {
  '100-lt-saklama-kutusu-2li-set': [
    { eski: "kutuları, 3'lü set halinde", yeni: "kutuları, 2'li set halinde", kanit: 'ana görsel «100 LT x 2 ADET SET · 2 ADET SET»; metin 3\'lü setten kopya' },
    { eski: 'Toplam 100 litre depolama alanı', yeni: 'Toplam 200 litre (2 × 100 Lt) depolama alanı', kanit: 'ana görsel «100 LT x 2 ADET SET»' },
  ],
  'kare-4lu-ahsap-vakumlu-kare-kapakli-cam-kahvaltilik-cok-amacli-cam-cerezlik-235-ml': [
    { eski: 'Çerezlik 230 ml</p>', yeni: 'Çerezlik 235 ml</p>', kanit: 'aynı açıklamada «Ürün Hacmi : 235 ml»; başlık ve kardeş ürün 235 ml' },
  ],
};

const say = (s: string, alt: string) => s.split(alt).length - 1;

export type Karar =
  | { durum: 'duzeltilecek'; html: string; degisen: Array<{ once: string; sonra: string }>; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function karar(handle: string, html: string, liste: Record<string, Duzeltme[]> = DUZELTMELER): Karar {
  const d = liste[handle];
  if (!d) return { durum: 'degisiklik-yok', sebep: 'listede değil' };
  if (d.every((x) => say(html, x.eski) === 0 && say(html, x.yeni) === 1)) return { durum: 'degisiklik-yok', sebep: 'düzeltmeler zaten uygulanmış' };
  let yeni = html;
  let beklenen = duzMetin(html);
  for (const x of d) {
    const n = say(html, x.eski);
    if (n !== 1) return { durum: 'atlandi', sebep: `hedef ifade ${n} kez geçiyor (1 olmalı): «${x.eski}» — yazılmadı` };
    yeni = yeni.replace(x.eski, x.yeni);
    const [eD, yD] = [duzMetin(x.eski), duzMetin(x.yeni)];
    if (say(beklenen, eD) !== 1) return { durum: 'atlandi', sebep: `düz metinde hedef ifade tekil değil: «${eD}» — yazılmadı` };
    beklenen = beklenen.replace(eD, yD);
  }
  if (duzMetin(yeni) !== beklenen) return { durum: 'atlandi', sebep: 'metin kapısı: düz metin beklenenden farklı — yazılmadı' };
  if (karar(handle, yeni, liste).durum !== 'degisiklik-yok') return { durum: 'atlandi', sebep: 'idempotent değil — yazılmadı' };
  return { durum: 'duzeltilecek', html: yeni, degisen: d.map((x) => ({ once: duzMetin(x.eski), sonra: duzMetin(x.yeni) })), onceBayt: Buffer.byteLength(html), sonraBayt: Buffer.byteLength(yeni) };
}

export type Urun = { id: string; handle: string; html: string };
export type KutukSatiri = { handle: string; durum: 'duzeltilecek' | 'duzeltildi' | 'degisiklik-yok' | 'atlandi' | 'hata'; sebep?: string; degisen?: Array<{ once: string; sonra: string }>; onceBayt?: number; sonraBayt?: number; onceHtml?: string };
export type Ozet = { taranan: number; duzeltilecek: number; duzeltildi: number; degisiklikYok: number; atlandi: number; hata: number };

/** `uygula` false iken `yaz` HİÇ çağrılmaz. Yazmadan önce ürün YENİDEN okunur; değiştiyse yazılmaz. */
export async function duzeltmeCalistir(
  urunler: Iterable<Urun> | AsyncIterable<Urun>,
  dep: { oku: (id: string) => Promise<string | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean; liste?: Record<string, Duzeltme[]> },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, duzeltilecek: 0, duzeltildi: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for await (const u of urunler) {
    oz.taranan++;
    try {
      const k = karar(u.handle, u.html, sec.liste);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ handle: u.handle, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const olcu = { degisen: k.degisen, onceBayt: k.onceBayt, sonraBayt: k.sonraBayt };
      if (!sec.uygula) { oz.duzeltilecek++; dep.kutuk({ handle: u.handle, durum: 'duzeltilecek', ...olcu }); continue; }
      if ((await dep.oku(u.id)) !== u.html) { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: 'okuma ile yazma arasında açıklama değişti — yazılmadı' }); continue; }
      const r = await dep.yaz(u.id, k.html);
      if (!r.ok) { oz.hata++; dep.kutuk({ handle: u.handle, durum: 'hata', sebep: r.hata, ...olcu }); continue; }
      oz.duzeltildi++; dep.kutuk({ handle: u.handle, durum: 'duzeltildi', ...olcu, onceHtml: u.html });
    } catch (e) {
      oz.hata++; dep.kutuk({ handle: u.handle, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
