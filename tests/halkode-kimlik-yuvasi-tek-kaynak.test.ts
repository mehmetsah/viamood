/**
 * ÇİVİ — kimlik yuvası okuma TEK KAYNAK, ikinci yol artık çivili.
 *
 * ÖLÇÜLEN BORÇ (27 Eyl 2026, Elif · Halkbank VPOS turu): aynı altı satırlık okuma
 * İKİ yerde yazılıydı — `cfg()` ve `odemeOrtami()`. Mevcut çivi
 * `tests/halkode-kimlik-secimi.test.ts` yalnız `cfg()` yolunu tutuyordu, yani
 * `odemeOrtami()` ÇİVİSİZDİ. Bu deponun ölçülmüş "kopya = sessiz kayma" sınıfı:
 * yuva adı ya da geri düşüş sırası bir yerde değişince öteki sessizce ayrışır ve
 * sonuç CANLI PARA yolunda yanlış ortam/kimlik seçimidir (test ucuna canlı
 * kimlikle gitmek = Halköde `status 30`).
 *
 * ⚠ BANKAYA HİÇBİR İSTEK ATILMAZ — okuma saf fonksiyon, girdi fixture.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { canliKimlikOku, testKimlikOku } from '../src/lib/halkode/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KAYNAK = readFileSync(path.join(__dirname, '..', 'src/lib/halkode/client.ts'), 'utf8');
// Sahte değerler — gerçek hiçbir kimlik taşımaz.
const SAHTE = { canliId: 'CANLI-ID-FIXTURE', canliSecret: 'CANLI-SECRET-FIXTURE', canliMk: '$2y$10$fixtureCANLI',
                testId: 'TEST-ID-FIXTURE', testSecret: 'TEST-SECRET-FIXTURE', testMk: '$2y$10$fixtureTEST' };
const ENVLER = ['HALKODE_LIVE_APP_ID','HALKODE_LIVE_APP_SECRET','HALKODE_LIVE_MERCHANT_KEY',
                'HALKODE_APP_ID','HALKODE_APP_SECRET','HALKODE_MERCHANT_KEY'] as const;
let yedek: Record<string, string | undefined> = {};

beforeEach(() => { yedek = {}; for (const e of ENVLER) { yedek[e] = process.env[e]; delete process.env[e]; } });
afterEach(() => { for (const e of ENVLER) { if (yedek[e] === undefined) delete process.env[e]; else process.env[e] = yedek[e]!; } });

describe('yuva ayrımı — canlı ile test BİRBİRİNİ EZMEZ', () => {
  it('canlı okuyucu YALNIZ canlı yuvayı okur', () => {
    const k = canliKimlikOku({ halkode_live_app_id: SAHTE.canliId, halkode_live_app_secret: SAHTE.canliSecret,
      halkode_live_merchant_key: SAHTE.canliMk, halkode_app_id: SAHTE.testId } as never);
    expect(k.appId).toBe(SAHTE.canliId);
    expect(k.appId, 'canlı okuyucu TEST yuvasına sızdı').not.toBe(SAHTE.testId);
  });

  it('test okuyucu YALNIZ test yuvasını okur', () => {
    const k = testKimlikOku({ halkode_app_id: SAHTE.testId, halkode_app_secret: SAHTE.testSecret,
      halkode_merchant_key: SAHTE.testMk, halkode_live_app_id: SAHTE.canliId } as never);
    expect(k.appId).toBe(SAHTE.testId);
    expect(k.appId, 'test okuyucu CANLI yuvasına sızdı — test ucuna canlı kimlik gider (status 30)')
      .not.toBe(SAHTE.canliId);
  });

  it('SIZMA ASIL BURADA GÖRÜNÜR: test yuvası BOŞ + canlı DOLU → test okuyucu BOŞ döner', () => {
    // ⚠ ÖLÇÜLDÜ (27 Eyl 2026): üstteki iddia sızmaya KÖRDÜ. Test yuvası dolu
    // olduğu için `ps.halkode_app_id || ps.halkode_live_app_id` mutasyonunda ilk
    // terim kazanıyor ve sızma hiç görünmüyordu (mutant çıkış 0). Sızmanın
    // görünür olduğu tek hâl: TEST yuvası boş, CANLI yuva dolu.
    // Bu hâl bugünün prod'unda GERÇEK — `halkode_app_id` BOŞ, canlı üçlü DOLU.
    // Sızsa test sayfası testapp ucuna CANLI kimlikle giderdi (Halköde status 30).
    const k = testKimlikOku({ halkode_live_app_id: SAHTE.canliId,
      halkode_live_app_secret: SAHTE.canliSecret, halkode_live_merchant_key: SAHTE.canliMk } as never);
    expect(k, 'test yuvası boşken canlı kimlik sızdı').toEqual({ appId: '', appSecret: '', merchantKey: '' });
  });

  it('tersi de: canlı yuva BOŞ + test DOLU → canlı okuyucu BOŞ döner', () => {
    const k = canliKimlikOku({ halkode_app_id: SAHTE.testId,
      halkode_app_secret: SAHTE.testSecret, halkode_merchant_key: SAHTE.testMk } as never);
    expect(k, 'canlı yuva boşken test kimliği sızdı').toEqual({ appId: '', appSecret: '', merchantKey: '' });
  });
});

describe('okuma sırası — DB önce, env sonra', () => {
  it('DB dolu + env dolu → DB kazanır (operatörün son kararı)', () => {
    process.env.HALKODE_LIVE_APP_ID = 'ENVDEN-GELEN';
    expect(canliKimlikOku({ halkode_live_app_id: SAHTE.canliId } as never).appId).toBe(SAHTE.canliId);
  });

  it('DB boş + env dolu → env geri düşüşü çalışır (betikler kimliksiz kalmaz)', () => {
    process.env.HALKODE_APP_ID = 'ENVDEN-TEST';
    expect(testKimlikOku({} as never).appId).toBe('ENVDEN-TEST');
  });

  it('ikisi de boş → boş dize (undefined DEĞİL, kimlikDolu ölçebilsin)', () => {
    const k = canliKimlikOku({} as never);
    expect(k).toEqual({ appId: '', appSecret: '', merchantKey: '' });
  });

  it('DB alanı boş dize ise env devralır (kısmi doldurma sızmaz)', () => {
    process.env.HALKODE_LIVE_MERCHANT_KEY = 'ENVDEN-MK';
    const k = canliKimlikOku({ halkode_live_app_id: SAHTE.canliId, halkode_live_merchant_key: '' } as never);
    expect(k.appId).toBe(SAHTE.canliId);
    expect(k.merchantKey).toBe('ENVDEN-MK');
  });
});

describe('TEK KAYNAK — kopya geri gelirse kırılır', () => {
  const yorumsuz = KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

  it('canlı env adı kaynakta YALNIZ BİR kez okunuyor', () => {
    const n = (yorumsuz.match(/process\.env\.HALKODE_LIVE_APP_ID/g) || []).length;
    expect(n, 'kimlik okuma yine çoğaltılmış — sessiz kayma sınıfı geri geldi').toBe(1);
  });

  it('test env adı kaynakta YALNIZ BİR kez okunuyor', () => {
    const n = (yorumsuz.match(/process\.env\.HALKODE_APP_ID/g) || []).length;
    expect(n, 'kimlik okuma yine çoğaltılmış').toBe(1);
  });

  it('odemeOrtami tek kaynak okuyucuları KULLANIYOR (kendi kopyasını yazmıyor)', () => {
    const govde = yorumsuz.slice(yorumsuz.indexOf('export async function odemeOrtami'));
    const son = govde.slice(0, govde.indexOf('\n}') + 2);
    expect(son).toMatch(/canliKimlikOku\(ps\)/);
    expect(son).toMatch(/testKimlikOku\(ps\)/);
    expect(son, 'odemeOrtami yine elle env okuyor').not.toMatch(/process\.env\.HALKODE/);
  });
});

describe('sır hijyeni', () => {
  it('okuyucular hiçbir şey LOGLAMAZ', () => {
    const bolge = KAYNAK.slice(KAYNAK.indexOf('export function canliKimlikOku'),
                               KAYNAK.indexOf('export function testKimlikOku') + 400);
    expect(bolge).not.toMatch(/console\.(log|warn|error|info)/);
  });
});
