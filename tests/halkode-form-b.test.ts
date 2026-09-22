/**
 * Halköde kart formu — Seçenek B BÖLGE KİLİDİ (Mehmet onayı 21 Eyl 2026).
 *
 * Tasarım : tema-yamalari/tasarim/halkode-form-secenek-B.html  (onaylı maket — ÜST SINIR)
 * Ürün    : tema-yamalari/via-checkout.liquid.halkode-form-b   (canlı sections/via-checkout.liquid kopyası)
 *
 * Kural: makette olmayan düğme / rozet / seçici / metin üründe OLMAZ. Maketin form bölgesindeki
 * metin listesi, denetim sayıları ve taksit satırının yapısı ürünün ÇİZDİĞİ HTML ile birebir
 * karşılaştırılır. Üründe fazladan bir metin ya da denetim çıkarsa bu dosya kırılır.
 *
 * Dinamik değerler (tutarlar, taksit satırları, kart türü işareti, düğmedeki tutar) maketten
 * silinip ayrıca ölçülür: satır yapısı ve biçimi hkTaksitSatir ile, maketin kendi örnek satırına
 * karşı.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const TEMA = readFileSync(path.join(KOK, 'tema-yamalari/via-checkout.liquid.halkode-form-b'), 'utf8');
const MAKET = readFileSync(path.join(KOK, 'tema-yamalari/tasarim/halkode-form-secenek-B.html'), 'utf8');

function tekIndex(s: string, capa: string): number {
  const i = s.indexOf(capa);
  expect(i, `çapa yok: ${capa}`).toBeGreaterThan(-1);
  expect(s.indexOf(capa, i + 1), `çapa birden çok: ${capa}`).toBe(-1);
  return i;
}

function islev(s: string, ad: string): string {
  const bas = tekIndex(s, `function ${ad}(`);
  const ac = s.indexOf('{', s.indexOf(')', bas));
  let derinlik = 0;
  for (let i = ac; i < s.length; i++) {
    if (s[i] === '{') derinlik++;
    else if (s[i] === '}' && --derinlik === 0) return s.slice(bas, i + 1);
  }
  throw new Error(`gövde kapanmadı: ${ad}`);
}

/** Görünen metin düğümleri, sırasıyla (SVG içi atılır). */
function metinler(html: string): string[] {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .split(/<[^>]+>/)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
const say = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const oznitelikler = (html: string, ad: string) => [...html.matchAll(new RegExp(`${ad}="([^"]*)"`, 'g'))].map((m) => m[1]);

// --- Maketin form bölgesi: "Kart Bilgileri" başlık satırından güven listesinin sonuna ---
const M_BAS = tekIndex(MAKET, '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 12px"><b style="font-size:14.5px">Kart Bilgileri</b>');
const M_SON = MAKET.indexOf('</ul>', M_BAS) + '</ul>'.length;
const MAKET_FORM = MAKET.slice(M_BAS, M_SON);
// Dinamik yerler maketten silinir (ürün iskeletinde bunlar BOŞ doğar)
const MAKET_ISKELET = MAKET_FORM
  .replace(/<span class="cip">[^<]*<\/span>/, '<span class="cip"></span>')
  .replace(/<div class="tk__s[^"]*">[\s\S]*?<\/div>/g, '')
  .replace(/(<div class="tutar"><div><span>Ödenecek Tutar<\/span>)<small>[^<]*<\/small>(<\/div>)<b>[^<]*<\/b>/, '$1<small></small>$2<b></b>')
  .replace(/(<button class="ode"[^>]*>)[\s\S]*?(<\/button>)/, '$1$2');

// --- Ürünün çizdiği iskelet: saf işlev çalıştırılır ---
const URUN: string = new Function(`${islev(TEMA, 'hkIc')}\n${islev(TEMA, 'hkFormHtml')}\nreturn hkFormHtml();`)();
const money = new Function(`${islev(TEMA, 'money')}\nreturn money;`)() as (k: number) => string;
const satir = new Function('money', `${islev(TEMA, 'hkTaksitSatir')}\nreturn hkTaksitSatir;`)(money) as (
  n: number,
  kurus: number,
  sec: boolean,
) => string;

describe('bölge dilimleri doğru yerden kesildi', () => {
  it('maket bölgesi makul boyda ve dinamik yerler silindi', () => {
    expect(MAKET_FORM.length).toBeGreaterThan(4000);
    expect(MAKET_FORM.length).toBeLessThan(12000);
    expect(MAKET_ISKELET).not.toContain('166,67');
    expect(MAKET_ISKELET).not.toContain('Kredi kartı');
    expect(URUN.length).toBeGreaterThan(1500);
  });
});

describe('BÖLGE KİLİDİ — maket ↔ ürün', () => {
  it('görünen metinler birebir aynı ve aynı sırada', () => {
    const m = metinler(MAKET_ISKELET);
    expect(m.length).toBeGreaterThanOrEqual(15);
    expect(metinler(URUN)).toEqual(m);
  });

  it('denetim sayıları aynı: 4 alan, 1 düğme; seçici / bağlantı / görsel yok', () => {
    const gorunurInput = (h: string) => say(h, /<input\b(?![^>]*type="hidden")/g);
    expect(gorunurInput(URUN)).toBe(gorunurInput(MAKET_ISKELET));
    expect(gorunurInput(URUN)).toBe(4);
    expect(say(URUN, /<button\b/g)).toBe(say(MAKET_ISKELET, /<button\b/g));
    expect(say(URUN, /<label\b/g)).toBe(say(MAKET_ISKELET, /<label\b/g));
    expect(say(URUN, /<li\b/g)).toBe(say(MAKET_ISKELET, /<li\b/g));
    expect(say(URUN, /<(select|a|textarea|iframe|img)\b/g)).toBe(0);
    // Taşıyıcı: seçili taksiti hkOde'ye taşıyan gizli alan (görünmez, tek)
    expect(say(URUN, /<input\b[^>]*type="hidden"/g)).toBe(1);
  });

  it('ipuçları aynı (kart numarası yer tutucusu dışında)', () => {
    // Maket kart numarasını DOLU gösteriyor (yer tutucu görünmüyor). Ürünün "0000 0000 0000 0000"
    // yer tutucusu B öncesinden kalma mevcut metin — kaldırmak Mehmet'in kararı, raporda soruldu.
    const u = oznitelikler(URUN.replace(/placeholder="0000 0000 0000 0000"/, ''), 'placeholder');
    expect(u).toEqual(oznitelikler(MAKET_ISKELET, 'placeholder'));
    expect(oznitelikler(URUN, 'title')).toEqual(oznitelikler(MAKET_ISKELET, 'title'));
  });

  it('ikonlar maketteki çizgi SVG’ler (aynı yollar, currentColor); marka logosu yok', () => {
    const yollar = (h: string) => [...h.matchAll(/<svg[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => m[1]);
    expect(yollar(URUN)).toEqual(yollar(MAKET_ISKELET));
    for (const svg of URUN.match(/<svg[^>]*>/g) ?? []) {
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('fill="none"');
    }
    expect(URUN).not.toMatch(/visa|mastercard|troy|amex|bonus|axess|maximum|world/i);
    expect(URUN).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('B için YANLIŞ olan cümle yok: kart bizim sunucumuzdan geçer', () => {
    expect(URUN).not.toMatch(/doğrudan|uğramaz|iletilir|hiç görmez|görmüyoruz/);
    expect(URUN).toContain('Kart bilgileriniz Viamood’da kaydedilmez;');
  });
});

describe('taksit satırı — maketin örnek satırıyla aynı yapı ve biçim', () => {
  // Maketteki seçili satır: 3 taksit, 500,00 TL
  const mSatir = tekIndex(MAKET_FORM, '<div class="tk__s sec">');
  const MAKET_SATIR = MAKET_FORM.slice(mSatir, MAKET_FORM.indexOf('</div>', mSatir) + 6);

  it('metin: "3 taksit" · "3 × 166,67 TL" · "500,00 TL"', () => {
    expect(metinler(satir(3, 50000, true))).toEqual(metinler(MAKET_SATIR));
  });

  it('tek çekim satırında aylık tutar boş (maketteki gibi)', () => {
    const tek = MAKET_FORM.slice(tekIndex(MAKET_FORM, '<span>Tek çekim</span>') - 60);
    expect(metinler(satir(1, 50000, false))).toEqual(['Tek çekim', '500,00 TL']);
    expect(tek).toContain('<span class="tk__ay"></span>');
  });

  it('yapı: işaret · ad · aylık · toplam (+ erişilebilir radyo), seçili satır işaretli', () => {
    const roller = (h: string) => [...h.matchAll(/<span(?: class="([^"]*)")?>/g)].map((m) => (m[1] ?? '').replace(/^vco-hk-/, ''));
    expect(roller(satir(3, 50000, true))).toEqual(roller(MAKET_SATIR).map((r) => (r === 'rd' ? 'tk__rd' : r)));
    expect(satir(3, 50000, true)).toMatch(/class="vco-hk-tk__s is-sel"[\s\S]*type="radio"[^>]*checked/);
    expect(satir(2, 50000, false)).not.toMatch(/is-sel|checked/);
  });
});
