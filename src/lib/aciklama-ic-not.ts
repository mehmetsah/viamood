/**
 * #994995 · MÜŞTERİYE GÖRÜNEN İÇ NOTLARIN ÜRÜN AÇIKLAMASINDAN ÇIKARILMASI — taslakla, metin kapılı.
 *
 * `aciklama-sinif-soy` yalnız GÖRÜNMEZ öznitelikleri soyar ve görünür iç not taşıyan ürüne
 * bilerek DOKUNMAZ ("elle taslak gerekir"). Bu modül o elle taslağı uygular:
 * sahibin onayladığı TASLAK, canlı açıklamanın yerine yazılır — ama yalnız şu kapıların hepsi
 * geçerse:
 *   1. canlı açıklama, taslağın hazırlandığı ÖNCESİ ile md5 olarak AYNI (arada elle değiştiyse yazılmaz),
 *   2. canlıda en az bir iç not kalıbı ya da tekrarlanan tablo VAR (temiz ürüne dokunulmaz),
 *   3. taslakta iç not kalıbı YOK ve en çok bir tablo var,
 *   4. taslaktaki her metin parçası canlı açıklamada birebir geçiyor — YENİ BİLGİ EKLENMEZ.
 *
 * Çivi: tests/aciklama-ic-not.test.ts.
 */
import { createHash } from 'node:crypto';

/** Müşteriye sızmış iç not kalıpları (29 Eki canlı ölçümü, Hello Kitty HKT11000 / Kuromi KU007). */
export const IC_NOT_KALIPLARI: ReadonlyArray<RegExp> = [
  /ölçüp doğrula/, /Diğer alanlar:/, /SKU önerisi/, /isterseniz hazırlayayım/,
];

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const bayt = (s: string) => Buffer.byteLength(s, 'utf8');

function cozumle(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** Etiketler atılmış, varlıkları çözülmüş, boşlukları tekleştirilmiş düz metin. */
export function duzMetin(html: string): string {
  return cozumle(html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Taslaktaki her metin düğümü (boş olmayan). */
export function metinParcalari(html: string): string[] {
  return [...html.matchAll(/>([^<>]+)</g)].map((m) => cozumle(m[1] ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export const tabloSayisi = (html: string) => (html.match(/<table[\s>]/gi) ?? []).length;
export const bulunanKaliplar = (html: string) => IC_NOT_KALIPLARI.filter((r) => r.test(html)).map((r) => r.source);

export type TaslakKarari =
  | { durum: 'uygulanacak'; onceBayt: number; sonraBayt: number; cikanKaliplar: string[]; tabloOnce: number; tabloSonra: number }
  | { durum: 'atlandi'; sebep: string };

export function taslakKarar(canliHtml: string, beklenenOnceMd5: string, taslakHtml: string): TaslakKarari {
  if (md5(canliHtml) !== beklenenOnceMd5) return { durum: 'atlandi', sebep: 'canlı açıklama taslağın ÖNCESİ ile aynı değil — arada değişmiş, elle bakılmalı' };
  const kaliplar = bulunanKaliplar(canliHtml);
  const tabloOnce = tabloSayisi(canliHtml);
  if (kaliplar.length === 0 && tabloOnce < 2) return { durum: 'atlandi', sebep: 'canlıda iç not kalıbı ya da tekrarlanan tablo yok' };
  const kalanKalip = bulunanKaliplar(taslakHtml);
  if (kalanKalip.length) return { durum: 'atlandi', sebep: `taslakta iç not kalıbı kalmış: ${kalanKalip.join(', ')}` };
  const tabloSonra = tabloSayisi(taslakHtml);
  if (tabloSonra > 1) return { durum: 'atlandi', sebep: `taslakta ${tabloSonra} tablo var (en çok 1)` };
  const canliMetin = duzMetin(canliHtml);
  const yeni = metinParcalari(taslakHtml).filter((p) => !canliMetin.includes(p));
  if (yeni.length) return { durum: 'atlandi', sebep: `taslak canlıda olmayan metin içeriyor (yeni bilgi yasak): ${yeni.slice(0, 3).join(' | ')}` };
  return { durum: 'uygulanacak', onceBayt: bayt(canliHtml), sonraBayt: bayt(taslakHtml), cikanKaliplar: kaliplar, tabloOnce, tabloSonra };
}

export type Is = { handle: string; onceMd5: string; taslakHtml: string };
export type Urun = { id: string; html: string };
export type KutukSatiri = {
  handle: string; durum: 'uygulanacak' | 'uygulandi' | 'atlandi' | 'hata';
  sebep?: string; onceBayt?: number; sonraBayt?: number; cikanKaliplar?: string[]; tabloOnce?: number; tabloSonra?: number; onceHtml?: string;
};
export type Ozet = { taranan: number; uygulanacak: number; uygulandi: number; atlandi: number; hata: number };

/**
 * Toplu çalıştırma. `uygula` false iken `yaz` HİÇ çağrılmaz. Bir üründeki hata süreci durdurmaz.
 * `uygula` kipinde yazmadan hemen önce ürün YENİDEN okunur ve kapılar yeniden koşar;
 * kütükteki `uygulandi` satırı geri alma için öncesi HTML'i taşır.
 */
export async function taslakCalistir(
  isler: Is[],
  dep: { oku: (handle: string) => Promise<Urun | null>; yaz: (id: string, html: string) => Promise<{ ok: true } | { ok: false; hata: string }>; kutuk: (s: KutukSatiri) => void },
  sec: { uygula: boolean },
): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, uygulanacak: 0, uygulandi: 0, atlandi: 0, hata: 0 };
  for (const is of isler) {
    oz.taranan++;
    try {
      const u = await dep.oku(is.handle);
      if (!u) { oz.hata++; dep.kutuk({ handle: is.handle, durum: 'hata', sebep: 'ürün bulunamadı' }); continue; }
      const k = taslakKarar(u.html, is.onceMd5, is.taslakHtml);
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ handle: is.handle, durum: 'atlandi', sebep: k.sebep }); continue; }
      const { durum: _d, ...olcu } = k;
      if (!sec.uygula) { oz.uygulanacak++; dep.kutuk({ handle: is.handle, durum: 'uygulanacak', ...olcu }); continue; }
      const taze = await dep.oku(is.handle);
      if (!taze || taslakKarar(taze.html, is.onceMd5, is.taslakHtml).durum !== 'uygulanacak') {
        oz.atlandi++; dep.kutuk({ handle: is.handle, durum: 'atlandi', sebep: 'okuma ile yazma arasında açıklama değişti — yazılmadı' }); continue;
      }
      const r = await dep.yaz(u.id, is.taslakHtml);
      if (!r.ok) { oz.hata++; dep.kutuk({ handle: is.handle, durum: 'hata', sebep: r.hata, ...olcu }); continue; }
      oz.uygulandi++; dep.kutuk({ handle: is.handle, durum: 'uygulandi', ...olcu, onceHtml: u.html });
    } catch (e) {
      oz.hata++; dep.kutuk({ handle: is.handle, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) });
    }
  }
  return oz;
}
