/**
 * #994831 · AÇIKLAMASI BAŞKA ÜRÜNÜ ANLATAN ÜRÜNLER — Mehmet kararı (31 Eki 2026): DÜZELT.
 *
 * Bu sınıfta istisnai olarak mevcut metin KORUNMAZ: açıklama müşteriye yanlış ürünü anlatıyor. Yanlış açıklama
 * kaldırılır, yerine cümle→kaynak eşlemesinin BİREBİR çıktısı yazılır. Kütüğe ÖNCESİ HTML yazılır (geri alınabilir).
 *
 * Girdi satırı (veri/994831-aciklama-degistir.jsonl):
 *   { handle, baslik, oncekiHtml, yanlisAdlar, dogruAdlar, yeniHtml, eslem[{bolum, metin, kaynaklar}], bosBirakilan }
 *
 * KAPI — ürün ancak HEPSİ sağlanırsa yazılır:
 *   1. canlı açıklama = oncekiHtml (satır sonu normalleştirmesiyle). Farklıysa başka bir tur yazmış olabilir → ATLA,
 *   2. ÇELİŞKİ GERÇEK: öncesinin düz metninde yanlış adlardan en az biri geçer; yanlış adların HİÇBİRİ başlıkta geçmez;
 *      doğru adların HEPSİ başlıkta geçer,
 *   3. METİN KAPISI: yeniHtml = eslemdenHtml(eslem) — yazılan her paragraf/madde/tablo satırı bir eşlemenin kendisi,
 *   4. yeni metinde yanlış adların HİÇBİRİ geçmez; doğru adların HEPSİ geçer,
 *   5. temizlediğimiz sınıflar geri gelmez: kuyruk iç bloğu · baş iç dizisi · pazar yeri/SEO/sohbet/kargo-iade sözcükleri,
 *   6. KALİTE KAPISI (aciklama-ekle ile aynı): ≥ 10 kaynaklı satır VE «Teknik Bilgiler»de Ölçek/Malzeme/Paket adedi.
 *      Sağlanmazsa yeni metin YAZILMAZ; onun yerine yalnız yanlış adı içeren CÜMLELER öncesinden çıkarılır
 *      (`yanlisCumleleriCikar`) — yanlış bilgi canlıda kalmaz, uydurma da eklenmez. Geriye bir şey kalmıyorsa ATLA.
 *   7. idempotent: canlı zaten hedefse değişiklik-yok.
 * Başlık ve handle DEĞİŞMEZ.
 *
 * YARIM CÜMLE KİPİ (#994831 kalan içerik, Mehmet kararı 31 Eki 2026: «yarım cümle ÇIKARILIR, yerine hiçbir şey
 * UYDURULMAZ»). Girdi satırı { handle, baslik, oncekiHtml, yarimParca } — açıklama noktalama olmadan «… Ürünün» gibi
 * yarım biten bir parçayla bitiyor. KAPI: canlı = öncesi · parça 1-3 sözcük, noktalamasız · düz metin bu parçayla
 * biter ve parçadan hemen önce cümle sonu (. ! ?) vardır · yeni HTML = öncesinden YALNIZ « parça» baytları silinmiş hâl
 * (başka bayt değişmez, yeni sözcük yok) · yeni düz metin cümle sonu işaretiyle biter · iç blok gelmez. Kalite kapısı
 * bu kipte UYGULANMAZ: hiçbir şey yazılmıyor, yalnız yarım parça düşüyor.
 *
 * ÖLÇÜ KİPİ (#994831 Jada Stitch, Mehmet kararı 1 Kas 2026: «ölçü ifadeleri TEK ve kaynaklı hâle getirilecek»).
 * Girdi satırı { handle, baslik, oncekiHtml, olcu{ifade, kaynak}, degisimler[{eski, yeni}], yasakOlculer, korunan, yeniHtml }
 * — açıklamada aynı ürün için birden çok, kaynaksız ölçü geçiyor. Metin yeniden YAZILMAZ; yalnız ölçü taşıyan
 * parçalar (satır/hücre/sözcük öbeği) değiştirilir ya da düşer. KAPI: canlı = öncesi · her `eski` öncesinde TAM BİR
 * kez geçer, parçalar örtüşmez · METİN KAPISI: yeniHtml = olcuUygula(öncesi, değişimler) (başka bayt değişmez) ·
 * öncesinde yasak ölçülerden en az biri geçer (sorun ölçüldü), yenide HİÇBİRİ geçmez · yeni metin `olcu.ifade`yi
 * içerir · KAYNAK: değişimlerin yazdığı her sayı, ürünün kendi görselindeki ölçü alıntısındaki bir sayıya 0,1'den
 * yakındır (5 ← 5.08cm · 2 ← 2in) — kaynakta olmayan sayı yazılamaz · `korunan` cümleler öncesindeki sayıda kalır
 * (karar bekleyen cümlelere dokunulmaz) · iç blok / yasak sözcük gelmez. Kalite kapısı UYGULANMAZ: yeni içerik yok.
 *
 * Çivi: tests/aciklama-degistir.test.ts · tests/aciklama-jada-olcu.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { kuyrukBul } from './aciklama-pazar-blok';
import { basDiziBul } from './aciklama-bas-blok';
import { kaliteKapisi, satirSonsuz, YASAK_SOZ } from './aciklama-ekle';

export type Kaynak = { tur: 'baslik' | 'uretici' | 'ambalaj' | 'urun-gorseli'; kaynak: string; alinti: string };
export type Eslem = { bolum: 'gövde' | 'Öne Çıkanlar' | 'Teknik Bilgiler' | 'Paket İçeriği'; metin: string; kaynaklar: Kaynak[] };
export type Giris = {
  handle: string; baslik: string; oncekiHtml: string;
  yanlisAdlar: string[]; dogruAdlar: string[];
  yeniHtml: string; eslem: Eslem[]; bosBirakilan?: string[];
};

const kucuk = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
const kac = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const adGecer = (metin: string, ad: string) => kucuk(metin).includes(kucuk(ad));

/** Eşlemenin tek doğru HTML çıktısı (dalga 2 düzeni): gövde → Öne Çıkanlar → Teknik Bilgiler → Paket İçeriği. */
export function eslemdenHtml(eslem: Eslem[]): string {
  const b = (ad: Eslem['bolum']) => eslem.filter((e) => e.bolum === ad).map((e) => e.metin);
  const p = (xs: string[]) => xs.map((x) => `<p>${kac(x)}</p>`).join('');
  let h = p(b('gövde'));
  const one = b('Öne Çıkanlar');
  if (one.length) h += `<h3>Öne Çıkanlar</h3><ul>${one.map((x) => `<li>${kac(x)}</li>`).join('')}</ul>`;
  const tek = b('Teknik Bilgiler');
  if (tek.length) {
    h += '<h2>Teknik Bilgiler</h2><table><tbody><tr><th>Özellik</th><th>Bilgi</th></tr>';
    for (const x of tek) { const i = x.indexOf(': '); h += `<tr><td>${kac(x.slice(0, i))}</td><td>${kac(x.slice(i + 2))}</td></tr>`; }
    h += '</tbody></table>';
  }
  const pk = b('Paket İçeriği');
  if (pk.length) h += `<h2>Paket İçeriği</h2>${p(pk)}`;
  return h;
}

/**
 * Kalite kapısı geçmezse kullanılan YEDEK: <p>/<li> blokları cümlelere bölünür (nokta/ünlem/soru sonrası boşluk ya da
 * « - » madde işareti), yanlış ad içeren cümle atılır, kalan cümleler sırasıyla aynı blok etiketinde bırakılır.
 * Yeni sözcük EKLENMEZ. Blok dışı her şey (başlıklar, tablolar) olduğu gibi kalır.
 */
export function yanlisCumleleriCikar(html: string, yanlisAdlar: string[]): string {
  return satirSonsuz(html).replace(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/g, (_t, et: string, oz: string, ic: string) => {
    const parca = ic.split(/(?<=[.!?])\s+|\s+-\s+|^-\s+/).map((x) => x.trim()).filter(Boolean);
    const kalan = parca.filter((x) => !yanlisAdlar.some((a) => adGecer(duzMetin(x), a)));
    return kalan.length ? `<${et}${oz}>${kalan.join(' ')}</${et}>` : '';
  });
}

export type Karar =
  | { durum: 'yazilacak'; kip: 'degistir' | 'cikar' | 'yarim' | 'olcu'; html: string; onceBayt: number; sonraBayt: number }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function hedef(g: Giris): { kip: 'degistir' | 'cikar'; html: string } {
  return kaliteKapisi(g).gecti ? { kip: 'degistir', html: g.yeniHtml } : { kip: 'cikar', html: yanlisCumleleriCikar(g.oncekiHtml, g.yanlisAdlar) };
}

export function karar(g: Giris, canli: string): Karar {
  const { kip, html } = hedef(g);
  if (satirSonsuz(canli) === satirSonsuz(html) && html.trim()) return { durum: 'degisiklik-yok', sebep: 'zaten yazılı (satır sonu normalleştirmesiyle)' };
  if (satirSonsuz(canli) !== satirSonsuz(g.oncekiHtml)) return { durum: 'atlandi', sebep: 'canlı açıklama kütükteki öncesinden farklı — yazılmadı' };
  const once = duzMetin(g.oncekiHtml);
  if (!g.yanlisAdlar.length || !g.yanlisAdlar.some((a) => adGecer(once, a))) return { durum: 'atlandi', sebep: 'öncesinde yanlış ad geçmiyor — çelişki ölçülmedi, yazılmadı' };
  if (g.yanlisAdlar.some((a) => adGecer(g.baslik, a))) return { durum: 'atlandi', sebep: 'yanlış sayılan ad başlıkta geçiyor — yazılmadı' };
  if (!g.dogruAdlar.length || !g.dogruAdlar.every((a) => adGecer(g.baslik, a))) return { durum: 'atlandi', sebep: 'doğru ad başlıkta yok — yazılmadı' };
  if (kip === 'degistir' && g.yeniHtml !== eslemdenHtml(g.eslem)) return { durum: 'atlandi', sebep: 'metin kapısı: yeni HTML kaynak eşlemesinin birebir çıktısı değil — yazılmadı' };
  if (!html.trim() || !duzMetin(html)) return { durum: 'atlandi', sebep: 'yanlış cümleler çıkarılınca açıklamada metin kalmıyor — yazılmadı' };
  const yeniDuz = duzMetin(html);
  const kalanYanlis = g.yanlisAdlar.filter((a) => adGecer(yeniDuz, a));
  if (kalanYanlis.length) return { durum: 'atlandi', sebep: `yeni metinde yanlış ad geçiyor: ${kalanYanlis.join(', ')} — yazılmadı` };
  if (kip === 'degistir' && !g.dogruAdlar.every((a) => adGecer(yeniDuz, a))) return { durum: 'atlandi', sebep: 'yeni metinde doğru ad yok — yazılmadı' };
  if (!('yok' in kuyrukBul(html, g.baslik))) return { durum: 'atlandi', sebep: 'yeni metin kuyruk iç bloğu içeriyor — yazılmadı' };
  if (!('yok' in basDiziBul(html, g.baslik))) return { durum: 'atlandi', sebep: 'yeni metin baş iç dizisi içeriyor — yazılmadı' };
  if (kip === 'degistir' && YASAK_SOZ.test(kucuk(yeniDuz))) return { durum: 'atlandi', sebep: 'yeni metin yasak sözcük içeriyor — yazılmadı' };
  return { durum: 'yazilacak', kip, html, onceBayt: Buffer.byteLength(canli), sonraBayt: Buffer.byteLength(html) };
}

export type YarimGiris = { handle: string; baslik: string; oncekiHtml: string; yarimParca: string };
export const yarimMi = (g: Giris | YarimGiris): g is YarimGiris => 'yarimParca' in g;
const CUMLE_SONU = /[.!?…]$/;

/** Son metinli <p>/<li> bloğunun sonundaki « parça»yı siler; o blok başka bir şeyle bitiyorsa null. Başka bayta dokunmaz. */
export function yarimCumleCikar(html: string, parca: string): string | null {
  const bloklar = [...html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].filter((m) => duzMetin(m[2] ?? ''));
  const son = bloklar[bloklar.length - 1];
  if (!son || son.index === undefined) return null;
  const ic = son[2] ?? '', icBas = son.index + son[0].indexOf('>') + 1;
  const kirp = ic.replace(/\s+$/, '');
  if (!kirp.endsWith(' ' + parca)) return null;
  const sil = icBas + kirp.length - parca.length - 1;
  return html.slice(0, sil) + html.slice(sil + parca.length + 1);
}

export function yarimKarar(g: YarimGiris, canli: string): Karar {
  const p = g.yarimParca;
  if (!p || p !== p.trim() || /[.!?…<>]/.test(p) || p.split(/\s+/).length > 3) return { durum: 'atlandi', sebep: 'yarım parça geçersiz (boş · noktalamalı · 3 sözcükten uzun) — yazılmadı' };
  const html = yarimCumleCikar(g.oncekiHtml, p);
  if (html !== null && satirSonsuz(canli) === satirSonsuz(html)) return { durum: 'degisiklik-yok', sebep: 'zaten yazılı (satır sonu normalleştirmesiyle)' };
  if (satirSonsuz(canli) !== satirSonsuz(g.oncekiHtml)) return { durum: 'atlandi', sebep: 'canlı açıklama kütükteki öncesinden farklı — yazılmadı' };
  const once = duzMetin(g.oncekiHtml);
  if (!once.endsWith(' ' + p)) return { durum: 'atlandi', sebep: 'açıklama yarım parçayla bitmiyor — yarım cümle ölçülmedi, yazılmadı' };
  if (!CUMLE_SONU.test(once.slice(0, -p.length - 1))) return { durum: 'atlandi', sebep: 'yarım parçadan önce cümle sonu yok — tam cümle kesilebilir, yazılmadı' };
  if (html === null) return { durum: 'atlandi', sebep: 'yarım parça son metin bloğunun sonunda değil — yazılmadı' };
  const yeni = duzMetin(html);
  if (Buffer.byteLength(g.oncekiHtml) - Buffer.byteLength(html) !== Buffer.byteLength(' ' + p) || yeni + ' ' + p !== once) return { durum: 'atlandi', sebep: 'metin kapısı: öncesinden yarım parça dışında bir şey değişiyor — yazılmadı' };
  if (!CUMLE_SONU.test(yeni)) return { durum: 'atlandi', sebep: 'parça çıkınca metin cümle sonuyla bitmiyor — yazılmadı' };
  if (!('yok' in kuyrukBul(html, g.baslik)) || !('yok' in basDiziBul(html, g.baslik))) return { durum: 'atlandi', sebep: 'yeni metin iç blok içeriyor — yazılmadı' };
  return { durum: 'yazilacak', kip: 'yarim', html, onceBayt: Buffer.byteLength(canli), sonraBayt: Buffer.byteLength(html) };
}

export type OlcuGiris = {
  handle: string; baslik: string; oncekiHtml: string;
  olcu: { ifade: string; kaynak: Kaynak }; degisimler: Array<{ eski: string; yeni: string }>;
  yasakOlculer: string[]; korunan: string[]; yeniHtml: string;
};
export const olcuMu = (g: Giris | YarimGiris | OlcuGiris): g is OlcuGiris => 'degisimler' in g;
const sayilar = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
const kacKez = (metin: string, parca: string) => (parca ? metin.split(parca).length - 1 : 0);

/** Değişimleri öncesindeki konumlarına göre uygular; bir `eski` tam bir kez geçmiyorsa ya da parçalar örtüşüyorsa null. */
export function olcuUygula(html: string, degisimler: OlcuGiris['degisimler']): string | null {
  const yer = degisimler.map((d) => ({ ...d, i: d.eski && kacKez(html, d.eski) === 1 ? html.indexOf(d.eski) : -1 }));
  if (!yer.length || yer.some((d) => d.i < 0)) return null;
  yer.sort((a, b) => a.i - b.i);
  for (let k = 1; k < yer.length; k++) if (yer[k]!.i < yer[k - 1]!.i + yer[k - 1]!.eski.length) return null;
  let h = html;
  for (const d of [...yer].reverse()) h = h.slice(0, d.i) + d.yeni + h.slice(d.i + d.eski.length);
  return h;
}

export function olcuKarar(g: OlcuGiris, canli: string): Karar {
  const html = olcuUygula(g.oncekiHtml, g.degisimler);
  if (html !== null && satirSonsuz(canli) === satirSonsuz(html)) return { durum: 'degisiklik-yok', sebep: 'zaten yazılı (satır sonu normalleştirmesiyle)' };
  if (satirSonsuz(canli) !== satirSonsuz(g.oncekiHtml)) return { durum: 'atlandi', sebep: 'canlı açıklama kütükteki öncesinden farklı — yazılmadı' };
  if (html === null) return { durum: 'atlandi', sebep: 'değişim parçası öncesinde tam bir kez geçmiyor ya da parçalar örtüşüyor — yazılmadı' };
  if (g.yeniHtml !== html) return { durum: 'atlandi', sebep: 'metin kapısı: yeni HTML değişimlerin öncesine birebir uygulanmış hâli değil — yazılmadı' };
  const once = duzMetin(g.oncekiHtml), yeni = duzMetin(html);
  if (!g.yasakOlculer.length || !g.yasakOlculer.some((o) => once.includes(o))) return { durum: 'atlandi', sebep: 'öncesinde kaynaksız ölçü geçmiyor — sorun ölçülmedi, yazılmadı' };
  const kalan = g.yasakOlculer.filter((o) => yeni.includes(o));
  if (kalan.length) return { durum: 'atlandi', sebep: `yeni metinde kaynaksız ölçü geçiyor: ${kalan.join(', ')} — yazılmadı` };
  if (!g.olcu.ifade || !kucuk(yeni).includes(kucuk(g.olcu.ifade))) return { durum: 'atlandi', sebep: 'yeni metinde kaynaklı ölçü ifadesi yok — yazılmadı' };
  const k = g.olcu.kaynak, ks = sayilar(k?.alinti ?? '');
  if (k?.tur !== 'urun-gorseli' || !k.kaynak || !ks.length) return { durum: 'atlandi', sebep: 'ölçü kaynağı ürünün kendi görselindeki ölçü alıntısı değil — yazılmadı' };
  const uydurma = g.degisimler.flatMap((d) => sayilar(duzMetin(d.yeni))).filter((x) => !ks.some((y) => Math.abs(x - y) < 0.1));
  if (uydurma.length) return { durum: 'atlandi', sebep: `kaynakta olmayan sayı yazılıyor: ${uydurma.join(', ')} — yazılmadı` };
  const bozulan = g.korunan.filter((c) => !kacKez(once, c) || kacKez(once, c) !== kacKez(yeni, c));
  if (bozulan.length) return { durum: 'atlandi', sebep: `korunan cümle değişiyor: ${bozulan.join(' | ')} — yazılmadı` };
  if (!('yok' in kuyrukBul(html, g.baslik)) || !('yok' in basDiziBul(html, g.baslik))) return { durum: 'atlandi', sebep: 'yeni metin iç blok içeriyor — yazılmadı' };
  if (YASAK_SOZ.test(kucuk(yeni))) return { durum: 'atlandi', sebep: 'yeni metin yasak sözcük içeriyor — yazılmadı' };
  return { durum: 'yazilacak', kip: 'olcu', html, onceBayt: Buffer.byteLength(canli), sonraBayt: Buffer.byteLength(html) };
}

export type Urun = { id: string; handle: string; html: string };
export type KutukSatiri = { handle: string; durum: 'yazilacak' | 'yazildi' | 'degisiklik-yok' | 'atlandi' | 'hata'; kip?: 'degistir' | 'cikar' | 'yarim' | 'olcu'; sebep?: string; onceBayt?: number; sonraBayt?: number; onceHtml?: string };
export type Ozet = { taranan: number; yazilacak: number; yazildi: number; degisiklikYok: number; atlandi: number; hata: number };

/** Yarım cümle satırları (`yarimParca`) yarimKarar'dan, ölçü satırları (`degisimler`) olcuKarar'dan, diğerleri karar'dan geçer. `uygula` false iken `yaz` HİÇ çağrılmaz. Yazmadan önce ürün YENİDEN okunur; değiştiyse yazılmaz. ÖNCESİ HTML kütüğe yazılır. */
export async function degistirCalistir(
  girisler: Array<Giris | YarimGiris | OlcuGiris>,
  dep: { bul: (handle: string) => Promise<Urun | null>; oku: (id: string) => Promise<string | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, yazilacak: 0, yazildi: 0, degisiklikYok: 0, atlandi: 0, hata: 0 };
  for (const g of girisler) {
    oz.taranan++;
    try {
      const u = await dep.bul(g.handle);
      if (!u) { oz.atlandi++; dep.kutuk({ handle: g.handle, durum: 'atlandi', sebep: 'aktif ürün bulunamadı' }); continue; }
      const k = olcuMu(g) ? olcuKarar(g, u.html) : yarimMi(g) ? yarimKarar(g, u.html) : karar(g, u.html);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ handle: g.handle, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: g.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const olcu = { kip: k.kip, onceBayt: k.onceBayt, sonraBayt: k.sonraBayt, onceHtml: u.html };
      if (!sec.uygula) { oz.yazilacak++; dep.kutuk({ handle: g.handle, durum: 'yazilacak', ...olcu }); continue; }
      if ((await dep.oku(u.id)) !== u.html) { oz.atlandi++; dep.kutuk({ handle: g.handle, durum: 'atlandi', sebep: 'okuma ile yazma arasında açıklama değişti — yazılmadı' }); continue; }
      const r = await dep.yaz(u.id, k.html);
      if (!r.ok) { oz.hata++; dep.kutuk({ handle: g.handle, durum: 'hata', sebep: r.hata, ...olcu }); continue; }
      oz.yazildi++; dep.kutuk({ handle: g.handle, durum: 'yazildi', ...olcu });
    } catch (e) {
      oz.hata++; dep.kutuk({ handle: g.handle, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
