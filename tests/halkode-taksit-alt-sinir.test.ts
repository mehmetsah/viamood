import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TAKSIT_ALT_SINIR_TL,
  VARSAYILAN_TAKSIT_ALT_SINIR_TL,
  taksitSecilebilir,
  taksitTutariYeterli,
} from '@/lib/halkode/taksit-tavan';

/**
 * Yunus, 22 Kas 2026: "Ödenecek son tutar 1.000 TL ve üzerindeyse taksitler bugünkü gibi
 * gösterilsin; altındaysa taksit çıkmasın, yalnız tek çekim olsun."
 *
 * Tutar = sepet + kargo − indirim (ödenecek SON tutar). Kural İKİ uçta da geçerli:
 * installments listeyi süzer, initialize isteği reddeder — yoksa istemci elle 999 TL'ye
 * 3 taksit gönderip kabul ettirebilirdi.
 */
describe('taksit alt sınırı — 1.000 TL', () => {
  it('varsayılan alt sınır 1000', () => {
    expect(VARSAYILAN_TAKSIT_ALT_SINIR_TL).toBe(1000);
    expect(TAKSIT_ALT_SINIR_TL).toBe(1000);
  });

  it('eşik DAHİL: 1000 TL taksit açar, 999,99 kapatır', () => {
    expect(taksitTutariYeterli(1000)).toBe(true);
    expect(taksitTutariYeterli(1000.01)).toBe(true);
    expect(taksitTutariYeterli(999.99)).toBe(false);
  });

  it('999,99 TL: 12 seçenekli API yanıtından YALNIZ tek çekim kalır', () => {
    const apiden = Array.from({ length: 12 }, (_, k) => ({
      installments_number: k + 1,
      amount_to_be_paid: '999.99',
    }));
    const gosterilen = apiden.filter((i) => taksitSecilebilir(i.installments_number, 999.99));
    expect(gosterilen.map((i) => i.installments_number)).toEqual([1]);
  });

  it('1000,00 TL: tavan neyse o kalır (1..3) — alt sınır tavanı GENİŞLETMEZ', () => {
    const apiden = Array.from({ length: 12 }, (_, k) => ({
      installments_number: k + 1,
      amount_to_be_paid: '1000.00',
    }));
    const gosterilen = apiden.filter((i) => taksitSecilebilir(i.installments_number, 1000));
    expect(gosterilen.map((i) => i.installments_number)).toEqual([1, 2, 3]);
  });

  it('tek çekim HER tutarda geçerli — müşteri ödemesiz kalmaz', () => {
    for (const tutar of [0.01, 10, 4.1, 999.99, 1000, 50000]) {
      expect(taksitSecilebilir(1, tutar)).toBe(true);
    }
    // Bozuk/eksik taksit sayısı tek çekim sayılır (Number(x)||1 → 1), tutar küçükse de geçer
    expect(taksitSecilebilir(undefined, 10)).toBe(true);
    expect(taksitSecilebilir(0, 10)).toBe(true);
  });

  it('tavan alt sınırdan BAĞIMSIZ durmaya devam ediyor', () => {
    expect(taksitSecilebilir(3, 5000)).toBe(true);
    expect(taksitSecilebilir(4, 5000)).toBe(false); // tavan 3
    expect(taksitSecilebilir(12, 5000)).toBe(false);
    expect(taksitSecilebilir(-5, 5000)).toBe(false);
  });

  it('bozuk tutar GÜVENLİ tarafa düşer: taksit kapanır, tek çekim açık kalır', () => {
    for (const bozuk of [undefined, null, NaN, 'abc', Infinity, {}]) {
      expect(taksitSecilebilir(3, bozuk)).toBe(false);
      expect(taksitSecilebilir(1, bozuk)).toBe(true);
    }
  });
});

/**
 * Env ile DEPLOY'SUZ ayar — HALKODE_MAKS_TAKSIT ile aynı düzen. Sabit modül yüklenirken
 * BİR KEZ okunduğu için ortam değişkenini sonradan yazmak yetmez; modül sıfırlanıp
 * yeniden import edilmeli (tests/env-bayrak.test.ts aynı kalıbı kullanıyor).
 */
async function sinirYukle(deger?: string) {
  vi.resetModules();
  if (deger === undefined) delete process.env.HALKODE_TAKSIT_ALT_SINIR_TL;
  else process.env.HALKODE_TAKSIT_ALT_SINIR_TL = deger;
  return import('@/lib/halkode/taksit-tavan');
}

describe('alt sınır env ile deploy\'suz değişiyor', () => {
  afterEach(() => {
    delete process.env.HALKODE_TAKSIT_ALT_SINIR_TL;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('2500 verilince 2000 TL taksit kapalı, 2500 açık', async () => {
    const m = await sinirYukle('2500');
    expect(m.TAKSIT_ALT_SINIR_TL).toBe(2500);
    expect(m.taksitSecilebilir(3, 2000)).toBe(false);
    expect(m.taksitSecilebilir(3, 2500)).toBe(true);
    expect(m.taksitSecilebilir(1, 2000)).toBe(true); // tek çekim yine serbest
  });

  it('0 verilince sınır KAPALI — deneme sayfaları (4,10 / 10 TL) taksit ölçebilir', async () => {
    const m = await sinirYukle('0');
    expect(m.TAKSIT_ALT_SINIR_TL).toBe(0);
    expect(m.taksitSecilebilir(3, 10)).toBe(true);
    expect(m.taksitSecilebilir(3, 4.1)).toBe(true);
    expect(m.taksitSecilebilir(12, 4.1)).toBe(false); // tavan hâlâ geçerli
  });

  it('bozuk değer varsayılana döner ve GÜRÜLTÜ çıkarır', async () => {
    for (const bozuk of ['abc', '-5']) {
      const uyari = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const m = await sinirYukle(bozuk);
      expect(m.TAKSIT_ALT_SINIR_TL, `${bozuk} varsayılana dönmeli`).toBe(1000);
      expect(uyari).toHaveBeenCalled();
      uyari.mockRestore();
    }
  });

  it('ortam değişkeni yoksa varsayılan 1000', async () => {
    const m = await sinirYukle(undefined);
    expect(m.TAKSIT_ALT_SINIR_TL).toBe(1000);
  });
});

/**
 * SÖZLEŞME ÇİVİSİ — kuralın İKİ uçta da gerçekten BAĞLI olduğunu ölçer.
 * 29 Eyl 2026'da tavan sabiti yazılmış, import girmiş, ama `.filter()` çağrısı hiç
 * eklenmemişti ve tema süzgeci kusuru görünmez kılmıştı. Aynı kaza alt sınırda
 * tekrarlanmasın: "sabit var" ve "import var" YETMEZ.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const kaynak = (yol: string) => readFileSync(join(process.cwd(), yol), 'utf8');

describe('alt sınır uçlarda GERÇEKTEN bağlı', () => {
  it('installments ucu listeyi istemciden gelen amount ile süzüyor', () => {
    const src = kaynak('src/app/api/v1/payment/halkode/installments/route.ts');
    expect(src).toContain("from '@/lib/halkode/taksit-tavan'");
    expect(src).toMatch(/\.filter\(\s*\(i\)\s*=>\s*taksitSecilebilir\(i\.installments_number,\s*amount\)\s*\)/);
  });

  it('initialize ucu KENDİ hesapladığı totalTl ile kapıyı kuruyor', () => {
    const src = kaynak('src/app/api/v1/payment/halkode/initialize/route.ts');
    // Tutar istemciden DEĞİL, sunucuda kurulur: sepet + kargo − indirim
    expect(src).toContain('const totalKurus = itemsKurus + shipKurus - discKurus;');
    expect(src).toMatch(/!taksitSecilebilir\(body\.installments_number,\s*totalTl\)/);
  });

  it('initialize alt sınır reddini AYRI hata koduyla veriyor', () => {
    const src = kaynak('src/app/api/v1/payment/halkode/initialize/route.ts');
    expect(src).toContain('taksit_alt_siniri');
    expect(src).toMatch(/taksitTutariYeterli\(totalTl\)/);
    // Tavan reddi kaybolmadı — iki ayrı sebep, iki ayrı kod
    expect(src).toContain('gecersiz_taksit_sayisi');
  });

  it('o 422 yanıtı CORS başlıklarıyla dönüyor — yoksa tema mesajı okuyamaz', () => {
    const src = kaynak('src/app/api/v1/payment/halkode/initialize/route.ts');
    // Başlıksız 422 tarayıcıda CORS'a takılır; müşteri gerçek sebep yerine
    // "Bağlantı hatası" görür. Bu yanıtta başlık EKSİKTİ, eklendi.
    //
    // ⚠ Çivi dosyadaki HERHANGİ bir `{ status: 422, headers }`e bakmaz — dosyada
    // başkaları da var, biri başlığını kaybetse çivi yine geçerdi (ölçüldü: mutasyon
    // testi 5, ilk hâli bu kaçağı yakalamıyordu). İki ayrı iddia kuruyoruz:
    expect(src).toMatch(/error: altSinir \? 'taksit_alt_siniri'/);
    // (1) alt sınır reddinin KENDİ yanıtı başlıklı — altSinir satırından sonraki
    //     ilk 422 başlıklı olmalı, araya sınırlı pencere konuyor ki uzağa kaçmasın.
    expect(src).toMatch(/error: altSinir \? 'taksit_alt_siniri'[\s\S]{0,700}?\{ status: 422, headers \}/);
    // (2) ve dosyada BAŞLIKSIZ 422 hiç kalmadı.
    expect(src).not.toMatch(/\{ status: 422 \}/);
  });

  it('tek çekim hiçbir uçta alt sınıra takılmıyor (kaynakta n === 1 muafiyeti)', () => {
    const src = kaynak('src/lib/halkode/taksit-tavan.ts');
    expect(src).toMatch(/return n === 1 \|\| taksitTutariYeterli\(tutarTl\)/);
  });
});
