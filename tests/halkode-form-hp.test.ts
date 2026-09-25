/**
 * Halköde kart formu — BÖLGE KİLİDİ (Yunus'un 23 Eyl 2026 örneği).
 *
 * Tasarım : tema-yamalari/tasarim/halkode-form-hp.html        (onaylı maket — ÜST SINIR)
 * Ürün    : tema-yamalari/via-checkout.liquid.halkode-form-hp (canlı sections/via-checkout.liquid kopyası)
 * Onay    : Ayşe Demiröz — #76 %89 (on dört ölçüt) · #102 %100 (iki eksik)
 *
 * Kural: makette olmayan düğme / rozet / seçici / metin üründe OLMAZ. Maketin metin listesi,
 * denetim sayıları, alan öznitelikleri ve hata metinleri ürünün ÇİZDİĞİ HTML ile karşılaştırılır.
 *
 * DEĞİŞMEZLER (güvenlik — kırılırsa iş durur): ödeme alanlarının id/data-hk adları, POST hedefi,
 * 3D Secure akışı (form_html → document.write) ve kart verisinin yalnız initialize ucuna gitmesi.
 *
 * Bu dosya 21 Eyl'deki "Seçenek B" kilidinin (halkode-form-b.test.ts) yerine geçer; o maket
 * tema-yamalari/tasarim/halkode-form-secenek-B.html'de tarihsel kayıt olarak durur.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const URUN = readFileSync(path.join(KOK, 'tema-yamalari/via-checkout.liquid.halkode-form-hp'), 'utf8');
const MAKET = readFileSync(path.join(KOK, 'tema-yamalari/tasarim/halkode-form-hp.html'), 'utf8');

function tekIndex(s: string, capa: string): number {
  const i = s.indexOf(capa);
  expect(i, `çapa yok: ${capa}`).toBeGreaterThan(-1);
  expect(s.indexOf(capa, i + 1), `çapa birden çok: ${capa}`).toBe(-1);
  return i;
}
function islev(s: string, ad: string): string {
  const bas = tekIndex(s, `function ${ad}(`);
  const ac = s.indexOf('{', s.indexOf(')', bas));
  let d = 0;
  for (let i = ac; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}' && --d === 0) return s.slice(bas, i + 1);
  }
  throw new Error(`gövde kapanmadı: ${ad}`);
}
/** hkFormHtml'in ürettiği HTML: '…' + '…' zinciri tek dizeye indirgenir (logo base64 atılır). */
function cizilenHtml(): string {
  // hkIc('ad', boy) çağrıları önce atılır: argümandaki ikon adı HTML metni değildir.
  const g = islev(URUN, 'hkFormHtml').replace(/hkIc\([^)]*\)/g, '<svg></svg>');
  return [...g.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((m) => m[1])
    .filter((t) => !t.startsWith('data:image/'))
    .join('')
    .replace(/\\'/g, "'");
}
/** Görünen metin düğümleri (SVG içi atılır). */
function metinler(html: string): string[] {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .split(/<[^>]+>/)
    .map((t) => t.replace(/&bull;/g, '•').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
const say = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const oznitelik = (s: string, ad: string) => [...s.matchAll(new RegExp(`${ad}="([^"]*)"`, 'g'))].map((m) => m[1]);

const URUN_HTML = cizilenHtml();
// Maketin modül gövdesi: <section class="hp"> … </section>
const M_BAS = tekIndex(MAKET, '<section class="hp"');
const MAKET_HTML = MAKET.slice(M_BAS, MAKET.indexOf('</section>', M_BAS) + 10);

describe('Halköde kart formu — maket üst sınırdır', () => {
  it('görünen metinlerin hepsi makette de var (fazladan metin YOK)', () => {
    const maketM = new Set(metinler(MAKET_HTML));
    // Üründe boş doğan dinamik yerler (tutar, taksit kutuları, banka adı, düğme yazısı) metin üretmez.
    const fazla = metinler(URUN_HTML).filter((t) => !maketM.has(t));
    expect(fazla, `makette olmayan metin: ${JSON.stringify(fazla)}`).toEqual([]);
  });

  it('alan sırası ve etiketleri maketle birebir', () => {
    const etiket = (s: string) =>
      [...s.matchAll(/<label class="hp-label"[^>]*>([\s\S]*?)<\/label>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
      );
    expect(etiket(URUN_HTML)).toEqual(etiket(MAKET_HTML));
    expect(etiket(URUN_HTML)).toEqual([
      'Kart Üzerindeki Ad Soyad',
      'Kart Numarası',
      'Son Kullanma',
      'Güvenlik Kodu (CVV)',
    ]);
  });

  it('denetim sayıları maketle aynı (fazladan düğme/alan YOK)', () => {
    // Gizli taşıyıcı (data-hk="taksit") görünür bir denetim değil — makette karşılığı yok.
    const gorunur = URUN_HTML.replace(/<input type="hidden"[^>]*>/g, '');
    for (const [ad, re] of [
      ['input', /<input\b/g],
      ['button', /<button\b/g],
      ['label', /<label\b/g],
      ['radiogroup', /role="radiogroup"/g],
      ['role=alert', /role="alert"/g],
      ['aria-live', /aria-live=/g],
    ] as const) {
      expect(say(gorunur, re), `denetim sayısı: ${ad}`).toBe(say(MAKET_HTML, re));
    }
  });

  it('autocomplete / maxlength / inputmode maketle birebir', () => {
    expect(oznitelik(URUN_HTML, 'autocomplete')).toEqual(['cc-name', 'cc-number', 'cc-exp', 'cc-csc']);
    expect(oznitelik(URUN_HTML, 'autocomplete')).toEqual(oznitelik(MAKET_HTML, 'autocomplete'));
    expect(oznitelik(URUN_HTML, 'maxlength')).toEqual(oznitelik(MAKET_HTML, 'maxlength'));
    expect(oznitelik(URUN_HTML, 'inputmode')).toEqual(oznitelik(MAKET_HTML, 'inputmode'));
  });

  it('ARIA üçlüsü: her alan aria-describedby taşır, aria-invalid doğrulamada yazılır, aria-live tutarda', () => {
    expect(say(URUN_HTML, /aria-describedby=/g)).toBe(4);
    expect(say(URUN_HTML, /aria-live="polite"/g)).toBe(1);
    expect(islev(URUN, 'hkFlag')).toContain("setAttribute('aria-invalid','true')");
    expect(islev(URUN, 'hkFlag')).toContain("removeAttribute('aria-invalid')");
  });

  it('beş Türkçe hata metni maketten birebir', () => {
    const beklenen = [
      'Ad ve soyadı kartta yazdığı gibi girin.',
      'Kart numarası geçersiz, haneleri kontrol edin.',
      'Tarihi AA / YY olarak girin.',
      'Kartın arkasındaki 3 haneli kodu girin.',
      'Kartın ön yüzündeki 4 haneli kodu girin.',
    ];
    for (const m of beklenen) {
      expect(MAKET, `maket metni değişmiş: ${m}`).toContain(m);
      expect(URUN, `ürün metni eksik: ${m}`).toContain(m);
    }
  });

  it('Luhn + son kullanma tarihi denetimi var', () => {
    expect(islev(URUN, 'hkVNo')).toContain('hkLuhn');
    expect(islev(URUN, 'hkVSkt')).toContain('getFullYear');
    expect(islev(URUN, 'hkVSkt')).toContain('getMonth');
  });

  it('taksit ızgarası 4 / 6 / 3 sütun kırılımını taşır', () => {
    expect(URUN).toContain('.hp-inst__list { display:grid; grid-template-columns:repeat(4, 1fr);');
    expect(URUN).toMatch(/@container \(min-width: 500px\)[\s\S]*?grid-template-columns:repeat\(6, 1fr\)/);
    expect(URUN).toMatch(/@container \(max-width: 299px\)[\s\S]*?grid-template-columns:repeat\(3, 1fr\)/);
    expect(URUN).toContain('container-type:inline-size');
  });

  it('3D Secure anlatımı ve marka rozetleri makettekiyle aynı', () => {
    for (const m of [
      '3D Secure',
      'Ödemeyi bankanızın doğrulama ekranında SMS şifresiyle onaylarsınız.',
      'bağlantı SSL ile şifrelidir.',
      'Visa, Mastercard, Troy',
      'Halk Bankası bağlı ortaklığıdır',
      'TCMB lisanslı elektronik para kuruluşudur.',
    ]) {
      expect(MAKET).toContain(m);
      expect(URUN_HTML + URUN).toContain(m);
    }
  });

  it('48px dokunma hedefi: alanlar 48, ödeme düğmesi 56', () => {
    expect(URUN).toMatch(/\.hp \.hp-input \{[^}]*height:48px/);
    expect(URUN).toMatch(/\.hp \.hp-pay \{[\s\S]*?height:56px/);
  });

  it('tipografi: 11px altında yazı boyutu YOK (nefes eşiği)', () => {
    const css = URUN.slice(tekIndex(URUN, '/* Halköde kart formu — Yunus'), tekIndex(URUN, '.vco-iyzico.is-hk .vco-err'));
    const kucuk = [...css.matchAll(/font-size:\s*(?:max\(11px,\s*)?(?:calc\()?([\d.]+)px/g)]
      .map((m) => parseFloat(m[1]))
      .filter((n) => n < 11);
    // 11px altı taban YALNIZ max(11px, …) sarmalı içinde kalabilir; sarmalsız olan kırmızıdır.
    const sarmalsiz = [...css.matchAll(/font-size:\s*(?!max\()[^;]*?([\d.]+)px/g)]
      .map((m) => parseFloat(m[1]))
      .filter((n) => n < 11);
    expect(sarmalsiz, `11px altı sarmalsız değer: ${sarmalsiz}`).toEqual([]);
    expect(kucuk.every(() => true)).toBe(true);
  });

  it('satır yüksekliği: tanımlı her line-height ≥ 1.3 (nefes eşiği)', () => {
    const css = URUN.slice(tekIndex(URUN, '/* Halköde kart formu — Yunus'), tekIndex(URUN, '.vco-iyzico.is-hk .vco-err'));
    const dusuk = [...css.matchAll(/line-height:\s*([\d.]+)\b(?!px)/g)]
      .map((m) => parseFloat(m[1]))
      .filter((n) => n < 1.3);
    expect(dusuk, `1.3 altı satır yüksekliği: ${dusuk}`).toEqual([]);
  });

  it('#102-a gönderim geri bildirimi: aria-busy + görünür spinner + çift gönderim koruması', () => {
    const y = islev(URUN, 'hkYukleniyor');
    expect(y).toContain("setAttribute('aria-busy'");
    expect(y).toContain("classList.toggle('is-loading'");
    expect(y).toContain('b.disabled');
    expect(URUN).toContain('<span class="hp-spin" aria-hidden="true"></span>');
    expect(URUN).toContain('.hp-pay.is-loading .hp-spin { display:block; }');
    // ikinci tıklama yutulur: hkOde ilk satırında busy kapısı
    expect(islev(URUN, 'hkOde')).toMatch(/^function hkOde\(\)\{?\s*\n\s*if\(hk\.busy\) return;/);
  });
});

describe('DEĞİŞMEZLER — ödeme akışı ve kart verisi', () => {
  it('alan id/data-hk adları değişmedi', () => {
    for (const id of ['vco-hk-ad', 'vco-hk-no', 'vco-hk-skt', 'vco-hk-cvv']) expect(URUN_HTML).toContain(`id="${id}"`);
    for (const d of ['ad', 'no', 'skt', 'cvv', 'taksit', 'ode', 'tutar']) expect(URUN_HTML).toContain(`data-hk="${d}"`);
  });
  it('POST hedefi ve gövde alanları değişmedi', () => {
    const o = islev(URUN, 'hkOde');
    expect(o).toContain("/api/v1/payment/halkode/initialize");
    for (const a of ['cc_holder_name', 'cc_no', 'expiry_month', 'expiry_year', 'cvv', 'installments_number'])
      expect(o, `gövde alanı: ${a}`).toContain(a);
  });
  it('3D Secure akışı: form_html belge olarak yazılır (iframe/innerHTML değil)', () => {
    expect(islev(URUN, 'hkOde')).toContain('document.open(); document.write(data.form_html); document.close();');
  });
  it('kart alanlarında name="" YOK — sayfa postback olsa bile kart verisi bize gitmez', () => {
    const alanlar = [...URUN_HTML.matchAll(/<input[^>]*data-hk="(ad|no|skt|cvv)"[^>]*>/g)].map((m) => m[0]);
    expect(alanlar).toHaveLength(4);
    for (const a of alanlar) expect(a, `name özniteliği var: ${a}`).not.toMatch(/\sname=/);
  });
  it('taksit sorgusu yalnız BIN gönderir (tam kart numarası DEĞİL)', () => {
    const s = islev(URUN, 'hkTaksitSorgu');
    expect(s).toContain('bin: hk.bin');
    expect(s).not.toContain('cc_no');
    expect(s).toMatch(/hk\.bin\s*=\s*''|bin:/);
  });
  it('kart verisi log\'a yazılmıyor', () => {
    const bolge = URUN.slice(tekIndex(URUN, '/* İkonlar — ince çizgi SVG'), tekIndex(URUN, '\n  function startPayment(opts){'));
    expect(bolge).not.toMatch(/console\.(log|info|warn|debug)/);
  });
});
