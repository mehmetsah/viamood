/**
 * Halköde KİMLİK SEÇİMİ — ÇİVİ.
 *
 * NEDEN: bu mantık canlı paranın geçtiği yol ve bugüne kadar hiçbir testi yoktu.
 * Koruma yalnız kaynaktaki yorum satırlarında yazılıydı — yorum kapı değildir.
 * Yarın biri "iki yuva fazlalık, tek yuvaya indirelim" derse ya da önceliği
 * env→DB'ye çevirirse canlı ödeme SESSİZCE test kimliğine düşerdi.
 *
 * YÖNTEM: iddia kopya mantık üzerinde değil, ÜRÜN KAYNAĞINDAN çıkarılan gerçek
 * satırlar üzerinde koşar (kopya, kaynak değişince sessizce yeşil kalır).
 * Çıkarılan bölge: client.ts — `canliMi` · `canliKimlik` · `testKimlik` · seçim satırı.
 *
 * 🔴 Testte hiçbir gerçek kimlik/secret YOKTUR; tüm değerler uydurmadır
 * ('APPID-CANLI' gibi). Canlı veritabanına ve gerçek ayarlara dokunulmaz.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KAYNAK = readFileSync(path.resolve(__dirname, '../src/lib/halkode/client.ts'), 'utf8');

function tekIndex(s: string, capa: string): number {
  const i = s.indexOf(capa);
  expect(i, `çapa yok: ${capa}`).toBeGreaterThan(-1);
  expect(s.indexOf(capa, i + 1), `çapa birden çok: ${capa}`).toBe(-1);
  return i;
}
/** Kaynaktan tek satır/blok çıkarır (ilk satırdan kapanışa). */
function dilim(bas: string, son: string): string {
  const i = tekIndex(KAYNAK, bas);
  const j = KAYNAK.indexOf(son, i);
  expect(j, `kapanış yok: ${son}`).toBeGreaterThan(-1);
  return KAYNAK.slice(i, j + son.length);
}

type Kimlik = { appId: string; appSecret: string; merchantKey: string };
type Ayar = Record<string, string | undefined>;

/**
 * Ürün kodundaki seçim mantığını GERÇEK satırlarla çalıştırır.
 * TS tip notasyonları JS'te geçersiz olduğu için yalnız `: Kimlik` atılır.
 */
/**
 * `odemeOrtami()` kararını ÜRÜN KAYNAĞINDAN çıkarılan gerçek satırlarla koşturur
 * (#991347). Kopya mantık yazılmadı — kaynak değişirse bu da değişir.
 */
function ortam(ps: Ayar, env: Ayar): 'test' | 'canli' | null {
  // `secim()` ile AYNI yöntem: iddia kopya mantıkta değil, ÜRÜN KAYNAĞINDAN
  // çıkarılan gerçek satırlarda koşar. Kimlik blokları artık `kimlikCifti()`
  // içinde — yani bu test ile `secim()` **aynı iki satırı** paylaşıyor; #991347'nin
  // tekilleştirmesi geri alınırsa ikisi birden ısırır.
  const kod = [
    dilim('const canliKimlik: Kimlik = {', '};'),
    dilim('const testKimlik: Kimlik = {', '};'),
    dilim('const kimlikDolu = ', ';'),
    // odemeOrtami()'nin KARAR satırları (kaynaktan, birebir):
    dilim("if (ps.halkode_test_mode === 0) return 'canli';", "return kimlikDolu(testKimlik) ? 'test' : null;"),
  ]
    .join('\n')
    .replace(/: Kimlik/g, '')
    // Çift ZATEN yukarıda bağlandı; kaynaktaki destructuring satırı burada
    // yeniden tanımlama olurdu. Tekilleştirmenin kendisi ayrı iddiada ölçülüyor.
    .replace('const { canliKimlik, testKimlik } = kimlikCifti(ps);', '');
  return new Function('ps', 'process', kod)(ps, { env }) ?? null;
}

function secim(baseUrl: string, ps: Ayar, env: Ayar): Kimlik & { canliMi: boolean } {
  const kod = [
    dilim('const canliMi = ', ';'),
    dilim('const canliKimlik: Kimlik = {', '};'),
    dilim('const testKimlik: Kimlik = {', '};'),
    dilim('const kimlikDolu = ', ';'),
    dilim('const k = canliMi && ', ';'),
    'return { ...k, canliMi };',
  ]
    .join('\n')
    .replace(/: Kimlik/g, '');
  return new Function('baseUrl', 'ps', 'process', kod)(baseUrl, ps, { env }) as Kimlik & {
    canliMi: boolean;
  };
}

const CANLI_UC = 'https://app.halkode.com.tr/ccpayment';
const TEST_UC = 'https://testapp.halkode.com.tr/ccpayment';
const CANLI_DOLU: Ayar = {
  halkode_live_app_id: 'APPID-CANLI',
  halkode_live_app_secret: 'SECRET-CANLI',
  halkode_live_merchant_key: 'MKEY-CANLI',
};
const TEST_DOLU: Ayar = {
  halkode_app_id: 'APPID-TEST',
  halkode_app_secret: 'SECRET-TEST',
  halkode_merchant_key: 'MKEY-TEST',
};

describe('Halköde kimlik seçimi — canlı paranın geçtiği yol', () => {
  it('1) canlı uç + canlı yuva DOLU → CANLI kimlik seçilir', () => {
    const k = secim(CANLI_UC, { ...CANLI_DOLU, ...TEST_DOLU }, {});
    expect(k.canliMi, 'app.halkode.* canlı sayılmadı').toBe(true);
    expect(k.appId).toBe('APPID-CANLI');
    expect(k.merchantKey).toBe('MKEY-CANLI');
  });

  it('2) canlı uç + canlı yuva EKSİK (merchant key boş) → TEST kimliğine düşer', () => {
    // Bugünkü davranış bilerek sabitleniyor: geri uyum dalı (scripts/halkode-*.ts).
    const eksik = { ...CANLI_DOLU, halkode_live_merchant_key: '' };
    const k = secim(CANLI_UC, { ...eksik, ...TEST_DOLU }, {});
    expect(k.appId, 'eksik canlı yuvada canlı kimlik seçilmiş').toBe('APPID-TEST');
  });

  it('2b) canlı yuvanın HER alanı tek tek eksilince de test kimliğine düşer', () => {
    for (const bos of ['halkode_live_app_id', 'halkode_live_app_secret', 'halkode_live_merchant_key']) {
      const k = secim(CANLI_UC, { ...CANLI_DOLU, [bos]: '', ...TEST_DOLU }, {});
      expect(k.appId, `${bos} boşken canlı kimlik seçildi`).toBe('APPID-TEST');
    }
  });

  it('3) test yuvasını DOLDURMAK canlı seçimi DEĞİŞTİRMEZ (biri diğerini ezmez)', () => {
    const yalnizCanli = secim(CANLI_UC, { ...CANLI_DOLU }, {});
    const ikisiDeDolu = secim(CANLI_UC, { ...CANLI_DOLU, ...TEST_DOLU }, {});
    expect(yalnizCanli.appId).toBe('APPID-CANLI');
    expect(ikisiDeDolu.appId, 'test yuvası canlıyı gölgeledi').toBe('APPID-CANLI');
    expect(ikisiDeDolu.merchantKey).toBe('MKEY-CANLI');
  });

  it('4) öncelik DB → env: ikisi de doluysa store_settings kazanır', () => {
    const k = secim(CANLI_UC, { ...CANLI_DOLU }, {
      HALKODE_LIVE_APP_ID: 'APPID-ENV',
      HALKODE_LIVE_APP_SECRET: 'SECRET-ENV',
      HALKODE_LIVE_MERCHANT_KEY: 'MKEY-ENV',
    });
    // ÜÇ ALANIN HER BİRİ ayrı ayrı ölçülür: yalnız appId ölçmek yetmiyordu —
    // mutasyon koşusunda merchantKey'in önceliği env||ps'ye çevrildiğinde çivi
    // sessizce yeşil kaldı (ölçüldü, 25 Eyl). Kapı her alan için ayrı kurulur.
    expect(k.appId, 'env, DB appId değerini gölgeledi').toBe('APPID-CANLI');
    expect(k.appSecret, 'env, DB appSecret değerini gölgeledi').toBe('SECRET-CANLI');
    expect(k.merchantKey, 'env, DB merchantKey değerini gölgeledi').toBe('MKEY-CANLI');
  });

  it('4b) DB boşken env YEDEK olarak devreye girer', () => {
    const k = secim(CANLI_UC, {}, {
      HALKODE_LIVE_APP_ID: 'APPID-ENV',
      HALKODE_LIVE_APP_SECRET: 'SECRET-ENV',
      HALKODE_LIVE_MERCHANT_KEY: 'MKEY-ENV',
    });
    expect(k.appId).toBe('APPID-ENV');
  });

  it('5) test ucu (testapp.halkode.*) → TEST kimliği seçilir', () => {
    const k = secim(TEST_UC, { ...CANLI_DOLU, ...TEST_DOLU }, {});
    expect(k.canliMi, 'testapp canlı sayıldı').toBe(false);
    expect(k.appId).toBe('APPID-TEST');
  });

  it('5b) staging adresi de canlı SAYILMAZ', () => {
    const k = secim('https://staging.halkode.com.tr/ccpayment', { ...CANLI_DOLU, ...TEST_DOLU }, {});
    expect(k.canliMi).toBe(false);
    expect(k.appId).toBe('APPID-TEST');
  });

  it('DEĞİŞMEZ: iki ayrı yuva ve seçim koşulu kaynakta duruyor', () => {
    expect(KAYNAK, 'canlı yuva kaldırılmış').toContain('halkode_live_app_id');
    expect(KAYNAK, 'test yuvası kaldırılmış').toContain('halkode_app_id');
    expect(KAYNAK, 'seçim koşulundan kimlikDolu düşmüş').toMatch(
      /const k = canliMi && kimlikDolu\(canliKimlik\) \? canliKimlik : testKimlik;/,
    );
    // Öncelik sırası DB→env olmalı: `ps.x || process.env.X`, tersi DEĞİL.
    for (const [db, env] of [
      ['halkode_live_app_id', 'HALKODE_LIVE_APP_ID'],
      ['halkode_live_app_secret', 'HALKODE_LIVE_APP_SECRET'],
      ['halkode_live_merchant_key', 'HALKODE_LIVE_MERCHANT_KEY'],
    ]) {
      expect(KAYNAK, `${db} önceliği DB→env değil`).toContain(`ps.${db} || process.env.${env}`);
    }
  });

  it('testte gerçek kimlik/sır yok — yalnız uydurma değerler', () => {
    const kendi = readFileSync(__filename, 'utf8');
    // Gerçek sır kalıpları: bcrypt ($2y$), JWT (eyJ…), 32+ haneli saf hex/base64 jeton.
    expect(kendi, 'bcrypt kalıbı').not.toMatch(/\$2[aby]\$\d{2}\$/);
    expect(kendi, 'JWT kalıbı').not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}/);
    expect(kendi, 'uzun hex jeton').not.toMatch(/\b[0-9a-f]{32,}\b/i);
    // Kullanılan tüm kimlik değerleri bilerek okunur ve kısadır.
    for (const v of ['APPID-CANLI', 'APPID-TEST', 'APPID-ENV', 'MKEY-CANLI', 'MKEY-TEST']) {
      expect(kendi).toContain(v);
    }
  });
});

/**
 * #991347 · GENİŞLETME — `odemeOrtami()` yolu da çiviye alındı.
 *
 * NEDEN: kimlik okuma kalıbı bu dosyada İKİ yerde kopyalanmıştı — `cfg()` (paranın
 * geçtiği yol) ve `odemeOrtami()` (ekrana ortamı söyleyen yol). Üstteki çivi yalnız
 * `cfg()` yolunu koruyordu; `odemeOrtami()` BEKÇİSİZDİ. Biri güncellenip öteki
 * unutulsaydı ödeme CANLI kimlikle giderken ekran "test" derdi.
 *
 * Kopya 2 Eki 2026'da `kimlikCifti()` ile tek kaynağa indirildi. Bu blok o tekilliği
 * ve iki yolun AYNI kaynaktan okuduğunu kilitler — bir daha ayrışamasın.
 */
describe('#991347 — iki yol TEK kaynaktan okur', () => {
  it('DEĞİŞMEZ: kimlik ifadeleri kaynakta TEK nüsha (kopya geri gelmesin)', () => {
    const say = (re: RegExp) => (KAYNAK.match(re) || []).length;
    // Yorum satırlarını ayıkla — gerekçe metninde ifade geçebilir, o KOD değildir.
    const kod = KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const kodSay = (re: RegExp) => (kod.match(re) || []).length;
    expect(kodSay(/process\.env\.HALKODE_LIVE_APP_ID/g), 'canlı appId ifadesi kopyalanmış').toBe(1);
    expect(kodSay(/process\.env\.HALKODE_APP_ID/g), 'test appId ifadesi kopyalanmış').toBe(1);
    expect(kodSay(/process\.env\.HALKODE_LIVE_MERCHANT_KEY/g)).toBe(1);
    expect(kodSay(/process\.env\.HALKODE_MERCHANT_KEY/g)).toBe(1);
    expect(say(/function kimlikCifti/g), 'tek okuma noktası yok').toBe(1);
  });

  it('DEĞİŞMEZ: cfg() ve odemeOrtami() İKİSİ DE kimlikCifti çağırır', () => {
    const cfgGovde = dilim('async function cfg(', '\n}');
    const ortamGovde = dilim('export async function odemeOrtami(', '\n}');
    expect(cfgGovde, 'cfg tek kaynaktan okumuyor').toContain('kimlikCifti(ps)');
    expect(ortamGovde, 'odemeOrtami tek kaynaktan okumuyor').toContain('kimlikCifti(ps)');
  });

  it('odemeOrtami: test_mode açıkça verilmişse kimliğe BAKILMADAN o ortam döner', () => {
    expect(ortam({ halkode_test_mode: 0 }, {})).toBe('canli');
    expect(ortam({ halkode_test_mode: 1 }, {})).toBe('test');
  });

  it('odemeOrtami: test_mode yokken CANLI yuva doluysa canli', () => {
    expect(ortam({ ...CANLI_DOLU }, {})).toBe('canli');
  });

  it('odemeOrtami: yalnız TEST yuvası doluysa test', () => {
    expect(ortam({ ...TEST_DOLU }, {})).toBe('test');
  });

  it('odemeOrtami: iki yuva da boşsa null (sessizce bir ortam UYDURMAZ)', () => {
    expect(ortam({}, {})).toBe(null);
  });

  it('🔴 AYRIŞMA KAPISI: cfg canlı kimlik seçerken odemeOrtami TEST diyemez', () => {
    // Ödeme yolu ile ekranın söylediği ortam aynı girdide AYNI sonucu vermeli.
    const k = secim(CANLI_UC, { ...CANLI_DOLU }, {});
    expect(k.canliMi).toBe(true);
    expect(k.appId).toBe('APPID-CANLI');
    expect(ortam({ ...CANLI_DOLU }, {}), 'ödeme canlı, ekran test diyor — AYRIŞMA').toBe('canli');
  });

  it('kimlik DEĞERİ hiçbir yere yazılmıyor — yalnız ortam etiketi', () => {
    // Bu testlerin ürettiği tek dışa dönük bilgi 'test' | 'canli' | null olmalı.
    for (const g of [{ ...CANLI_DOLU }, { ...TEST_DOLU }, {}]) {
      const e = ortam(g, {});
      expect(['test', 'canli', null], 'ortam etiketi dışında bir şey döndü').toContain(e);
    }
  });
});
