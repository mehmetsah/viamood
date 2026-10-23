/**
 * #994995 · ÜRÜN AÇIKLAMASINDAN GÖRÜNMEZ SOHBET-ARAYÜZÜ KALINTISINI SOYMA.
 *
 * Bazı ürün açıklamaları bir sohbet arayüzünden yapıştırıldığı için kaynağında
 * `class="font-claude-response-body break-words …"`, `data-*`, `aria-*`, `role`
 * öznitelikleri ve boş sarmalayıcı `<div>`/`<span>`'lar taşıyor. Ekranda görünmezler
 * ama sayfa kaynağında ve arama motorunda durur (ölçüm: 1168 üründen 50'si, 23 Eki 2026).
 *
 * KURAL: yalnız ÖZNİTELİK ve SARMALAYICI soyulur — metin düğümüne HİÇ dokunulmaz.
 * Yine de her ürün METİN KAPISINDAN geçer: soyma öncesi/sonrası düz metin
 * (etiketler atılmış hâl) birebir aynı değilse ürün ATLANIR. Kapı, soyucudaki
 * olası bir hatanın müşteriye görünen metni sessizce bozmasının tek engelidir.
 *
 * Görünür kalıntı taşıyan ürünler ("Diğer alanlar:", "Message 1 of 1" …) bu
 * araçla düzeltilmez: orada iç not metni silinmeli, yani elle taslak gerekir.
 *
 * Çivi: tests/aciklama-sinif-soy.test.ts.
 */

/** Soyulan öznitelikler: sohbet arayüzünden gelen sunum/erişilebilirlik işaretleri. */
export const SOYULAN_OZNITELIK = /^(?:class|data-[\w-]+|aria-[\w-]+|role|tabindex)$/i;

/** Bu işaretlerden biri varsa ürün ekranda görünen iç not taşır — araç dokunmaz. */
export const GORUNUR_KALINTI: ReadonlyArray<RegExp> = [
  /Diğer alanlar:/, /Kategori meta alanları/, /SKU önerisi/, /isterseniz hazırlayayım/,
  /ölçüp doğrula/, /Message \d+ of \d+/, /aria-label="Chat messages"/,
];

/** Sohbet arayüzü izi — aracın hedef kümesi bu işaretle seçilir. */
export const KALINTI_ISARETI = 'font-claude-response';

const BOS_ELEMAN = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BLOK = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
const SARMALAYICI = new Set(['div', 'span']);

type Metin = { tur: 'metin'; ham: string };
type Eleman = { tur: 'eleman'; ad: string; acilis: string; kapanis: string | null; cocuklar: Dugum[] };
type Dugum = Metin | Eleman;

const JETON = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+|</g;
const OZNITELIK = /\s+([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;

/** HTML'i ağaca çevirir. Ağaç sırayla yazıldığında girdi BAYT BAYT geri gelir (çivi iddiası). */
function ayristir(html: string): Dugum[] {
  const kok: Eleman = { tur: 'eleman', ad: '#kok', acilis: '', kapanis: '', cocuklar: [] };
  const yigin: Eleman[] = [kok];
  for (const j of html.match(JETON) ?? []) {
    const ust = yigin[yigin.length - 1]!;
    if (!j.startsWith('<') || j.length === 1 || j.startsWith('<!--')) { ust.cocuklar.push({ tur: 'metin', ham: j }); continue; }
    if (j.startsWith('</')) {
      const ad = j.slice(2).replace(/[\s>].*$/s, '').toLowerCase();
      const i = yigin.map((e) => e.ad).lastIndexOf(ad);
      if (i <= 0) { ust.cocuklar.push({ tur: 'metin', ham: j }); continue; } // eşi olmayan kapanış: olduğu gibi kalır
      yigin[i]!.kapanis = j;
      yigin.length = i;
      continue;
    }
    const ad = j.slice(1).replace(/[\s/>].*$/s, '').toLowerCase();
    const e: Eleman = { tur: 'eleman', ad, acilis: j, kapanis: null, cocuklar: [] };
    ust.cocuklar.push(e);
    if (!BOS_ELEMAN.has(ad) && !/\/\s*>$/.test(j)) yigin.push(e);
  }
  return kok.cocuklar;
}

function yaz(d: Dugum[]): string {
  return d.map((n) => (n.tur === 'metin' ? n.ham : n.acilis + yaz(n.cocuklar) + (n.kapanis ?? ''))).join('');
}

/** Açılış etiketinden soyulacak öznitelikleri çıkarır; değişiklik yoksa etiketi ham bırakır. */
function acilisSoy(acilis: string, ad: string): { acilis: string; kalan: number } {
  const govde = acilis.slice(1 + ad.length).replace(/\/?\s*>$/, '');
  const kendindenKapali = /\/\s*>$/.test(acilis);
  const tum = [...govde.matchAll(OZNITELIK)];
  const kalan = tum.filter((m) => !SOYULAN_OZNITELIK.test(m[1] ?? ''));
  if (kalan.length === tum.length) return { acilis, kalan: kalan.length };
  return { acilis: `<${acilis.slice(1, 1 + ad.length)}${kalan.map((m) => m[0]).join('')}${kendindenKapali ? ' /' : ''}>`, kalan: kalan.length };
}

const bosMetin = (n: Dugum) => n.tur === 'metin' && n.ham.trim() === '' && !n.ham.startsWith('<!--');

/** Alttan yukarı: önce çocuklar temizlenir, sonra düğümün kendisi kararlaştırılır (tek geçişte sabit nokta). */
function temizle(d: Dugum[]): Dugum[] {
  const cikti: Dugum[] = [];
  for (const n of d) {
    if (n.tur === 'metin') { cikti.push(n); continue; }
    const { acilis, kalan } = acilisSoy(n.acilis, n.ad);
    const cocuklar = temizle(n.cocuklar);
    const yeni: Eleman = { ...n, acilis, cocuklar };
    if (SARMALAYICI.has(n.ad) && kalan === 0 && n.kapanis !== null) {
      if (cocuklar.every(bosMetin)) continue; // boş sarmalayıcı: tamamen düşer
      const gercek = cocuklar.filter((c) => !bosMetin(c));
      // span: sunumsal etkisi yok → aç. div: yalnız blok çocukları varsa aç (yerleşim değişmez).
      if (n.ad === 'span' || gercek.every((c) => c.tur === 'eleman' && BLOK.has(c.ad))) { cikti.push(...cocuklar); continue; }
    }
    cikti.push(yeni);
  }
  return cikti;
}

/** Görünür kalıntı korunarak soyulmuş HTML. Metin düğümleri ham hâliyle kalır. */
export function soy(html: string): string {
  return yaz(temizle(ayristir(html)));
}

/** Ayrıştırma + yazma girdiyi değiştirmeden geri verir mi (çivi ve öz-denetim için). */
export function gidisDonus(html: string): string {
  return yaz(ayristir(html));
}

/** Etiketler atılmış, boşlukları tekleştirilmiş metin — METİN KAPISININ ölçtüğü şey. */
export function duzMetin(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?[a-zA-Z][^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export type UrunKarari =
  | { durum: 'soyulacak'; html: string; onceBayt: number; sonraBayt: number; soyulanBayt: number }
  | { durum: 'degisiklik-yok'; onceBayt: number }
  | { durum: 'atlandi'; sebep: string; onceBayt: number };

const bayt = (s: string) => Buffer.byteLength(s, 'utf8');

/**
 * Tek ürün için karar. `donustur` yalnız çivide değiştirilir (metin kapısının
 * gerçekten kapı olduğunu ölçmek için bozuk dönüştürücü verilir).
 */
export function urunKarar(html: string, donustur: (h: string) => string = soy): UrunKarari {
  const onceBayt = bayt(html);
  const gorunur = GORUNUR_KALINTI.find((r) => r.test(html));
  if (gorunur) return { durum: 'atlandi', sebep: `görünür kalıntı (${gorunur.source}) — elle taslak gerekir`, onceBayt };
  if (gidisDonus(html) !== html) return { durum: 'atlandi', sebep: 'ayrıştırma girdiyi birebir geri vermedi', onceBayt };
  const sonra = donustur(html);
  if (sonra === html) return { durum: 'degisiklik-yok', onceBayt };
  if (duzMetin(sonra) !== duzMetin(html)) return { durum: 'atlandi', sebep: 'metin değişiyor, atlandı', onceBayt };
  if (donustur(sonra) !== sonra) return { durum: 'atlandi', sebep: 'idempotent değil (ikinci geçiş yine değiştiriyor), atlandı', onceBayt };
  const sonraBayt = bayt(sonra);
  return { durum: 'soyulacak', html: sonra, onceBayt, sonraBayt, soyulanBayt: onceBayt - sonraBayt };
}

export type Urun = { id: string; handle: string; html: string };
export type YazCevap = { ok: true } | { ok: false; hata: string };
export type KutukSatiri = {
  handle: string; durum: 'soyulacak' | 'soyuldu' | 'degisiklik-yok' | 'atlandi' | 'hata';
  sebep?: string; onceBayt?: number; sonraBayt?: number; soyulanBayt?: number; onceHtml?: string;
};
export type Ozet = { taranan: number; soyulacak: number; soyuldu: number; degisiklikYok: number; atlandi: number; hata: number; soyulanBayt: number };

/**
 * Toplu çalıştırma. `uygula` false iken `yaz` HİÇ çağrılmaz (dry-run).
 * Bir üründeki hata süreci durdurmaz; her ürün kütüğe tek satır düşer.
 * `uygula` kipinde kütük, geri alma için soyma öncesi HTML'i de taşır.
 */
export async function sinifSoyCalistir(
  urunler: Iterable<Urun> | AsyncIterable<Urun>,
  dep: { yaz: (u: Urun, yeniHtml: string) => Promise<YazCevap>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean; donustur?: (h: string) => string },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, soyulacak: 0, soyuldu: 0, degisiklikYok: 0, atlandi: 0, hata: 0, soyulanBayt: 0 };
  for await (const u of urunler) {
    oz.taranan++;
    try {
      const k = urunKarar(u.html, sec.donustur);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ handle: u.handle, durum: 'degisiklik-yok', onceBayt: k.onceBayt }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: u.handle, durum: 'atlandi', sebep: k.sebep, onceBayt: k.onceBayt }); continue; }
      const olcu = { onceBayt: k.onceBayt, sonraBayt: k.sonraBayt, soyulanBayt: k.soyulanBayt };
      if (!sec.uygula) { oz.soyulacak++; oz.soyulanBayt += k.soyulanBayt; dep.kutuk({ handle: u.handle, durum: 'soyulacak', ...olcu }); continue; }
      const r = await dep.yaz(u, k.html);
      if (!r.ok) { oz.hata++; dep.kutuk({ handle: u.handle, durum: 'hata', sebep: r.hata, ...olcu }); continue; }
      oz.soyuldu++; oz.soyulanBayt += k.soyulanBayt;
      dep.kutuk({ handle: u.handle, durum: 'soyuldu', ...olcu, onceHtml: u.html });
    } catch (e) {
      oz.hata++;
      dep.kutuk({ handle: u.handle, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
