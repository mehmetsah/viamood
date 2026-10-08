/**
 * #991676 — Otomatik e-posta akışları ÇEKİRDEK çivisi (Faz 1).
 *
 * Kapsam BİLEREK dar: zamanlama · kupon · 60 gün freni · İYS kanal seçimi.
 * ŞABLON METNİ ve görsel TEST EDİLMEZ — o kısım Ayşe onayına kalıyor, henüz yok.
 *
 * Her iddianın NEGATİF bacağı var: kural kaldırılırsa test KIRILMALI.
 * ⚠ Bu testler GERÇEK MAİL GÖNDERMEZ ve DB'ye dokunmaz — saf mantık ölçülür.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AKIS,
  ADIMLAR,
  FREN_GUN,
  TABAN_INDIRIM_YUZDE,
  UST_LIMIT_ESIGI_KURUS,
  UST_LIMIT_KURUS,
  akisPlani,
  indirimTutariKurus,
  kanalSec,
  kuponBitisi,
  kuponGecerliMi,
  kuponKoduUret,
  kuponVerilebilirMi,
  planlananAn,
} from '@/lib/eposta-akis';

const T0 = new Date('2026-10-03T09:00:00.000Z');
const SAAT = 3600_000;
const GUN = 24 * SAAT;

describe('A) Hoş geldin akışı — zamanlama', () => {
  it('adım 1 ANINDA gider (gecikme 0)', () => {
    expect(planlananAn(AKIS.HOS_GELDIN, 1, T0)?.toISOString()).toBe(T0.toISOString());
  });

  it('adım 2 tetikten +2 GÜN sonra', () => {
    expect(planlananAn(AKIS.HOS_GELDIN, 2, T0)?.getTime()).toBe(T0.getTime() + 2 * GUN);
  });

  it('NEGATİF: olmayan adım null döner — uydurma zamanlama üretilmez', () => {
    expect(planlananAn(AKIS.HOS_GELDIN, 3, T0)).toBeNull();
  });

  it('kupon YALNIZ 1. adımda — 2. adım hatırlatma, ikinci kod vermez', () => {
    const plan = akisPlani(AKIS.HOS_GELDIN, T0);
    expect(plan.map((p) => p.kupon)).toEqual([true, false]);
  });
});

describe('B) Sepet terki — 1sa / 24sa / 48sa', () => {
  it('üç adım ve tam gecikmeler', () => {
    const plan = akisPlani(AKIS.SEPET_TERKI, T0);
    expect(plan.map((p) => p.planlananAn.getTime() - T0.getTime())).toEqual([1 * SAAT, 24 * SAAT, 48 * SAAT]);
  });

  it('İLK adım İNDİRİMSİZ — kupon 2. adımda açılır', () => {
    const plan = akisPlani(AKIS.SEPET_TERKI, T0);
    expect(plan[0]!.kupon, '1. adımda kupon verilirse indirim avcılığı doğar').toBe(false);
    expect(plan[1]!.kupon).toBe(true);
    expect(plan[2]!.kupon).toBe(false);
  });
});

describe('C) Checkout terki — 1sa / 24sa', () => {
  it('iki adım, ikincisi kuponlu', () => {
    const plan = akisPlani(AKIS.CHECKOUT_TERKI, T0);
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.planlananAn.getTime() - T0.getTime())).toEqual([1 * SAAT, 24 * SAAT]);
    expect(plan.map((p) => p.kupon)).toEqual([false, true]);
  });
});

describe('İndirim tutarı + ÜST LİMİT', () => {
  it('taban yüzde 10', () => {
    expect(TABAN_INDIRIM_YUZDE).toBe(10);
    expect(indirimTutariKurus(50_000)).toBe(5_000); // 500 TL → 50 TL
  });

  it('eşikte (1.500 TL) limit DEVREDE DEĞİL — %10 aynen geçer', () => {
    expect(indirimTutariKurus(UST_LIMIT_ESIGI_KURUS)).toBe(15_000); // 150 TL
  });

  it('eşiğin ÜSTÜNDE indirim 300 TL tavanına vurur', () => {
    expect(indirimTutariKurus(500_000)).toBe(UST_LIMIT_KURUS); // %10=500 TL → 300 TL
    expect(indirimTutariKurus(1_000_000)).toBe(UST_LIMIT_KURUS);
  });

  it('NEGATİF: tavan kaldırılırsa bu sayı 50.000 olurdu — eşitlik tavanı kanıtlar', () => {
    expect(indirimTutariKurus(500_000)).not.toBe(50_000);
  });

  it('NEGATİF: sıfır/negatif/NaN sepet indirim üretmez', () => {
    expect(indirimTutariKurus(0)).toBe(0);
    expect(indirimTutariKurus(-100)).toBe(0);
    expect(indirimTutariKurus(Number.NaN)).toBe(0);
  });
});

describe('60 GÜN FRENİ', () => {
  it('fren süresi 60 gün', () => {
    expect(FREN_GUN).toBe(60);
  });

  it('hiç kupon almamış kişiye verilir', () => {
    expect(kuponVerilebilirMi(null, T0)).toBe(true);
    expect(kuponVerilebilirMi(undefined, T0)).toBe(true);
  });

  it('NEGATİF: 59 gün önce kupon almışa VERİLMEZ', () => {
    expect(kuponVerilebilirMi(new Date(T0.getTime() - 59 * GUN), T0)).toBe(false);
  });

  it('NEGATİF: dün kupon almışa VERİLMEZ', () => {
    expect(kuponVerilebilirMi(new Date(T0.getTime() - 1 * GUN), T0)).toBe(false);
  });

  it('tam 60 gün dolunca VERİLİR (sınır dahil)', () => {
    expect(kuponVerilebilirMi(new Date(T0.getTime() - 60 * GUN), T0)).toBe(true);
    expect(kuponVerilebilirMi(new Date(T0.getTime() - 61 * GUN), T0)).toBe(true);
  });
});

describe('Kupon — kişiye özel, TEK KULLANIMLIK', () => {
  it('kod akışa göre öneklenir ve rastgele bölüm taşır', () => {
    expect(kuponKoduUret(AKIS.HOS_GELDIN, () => 'a1b2c3')).toBe('HG-A1B2C3');
    expect(kuponKoduUret(AKIS.SEPET_TERKI, () => 'zz9')).toBe('ST-ZZ9');
    expect(kuponKoduUret(AKIS.CHECKOUT_TERKI, () => 'q')).toBe('CT-Q');
  });

  it('hoş geldin kuponu 7 gün, terk kuponları 48 saat yaşar', () => {
    expect(kuponBitisi(AKIS.HOS_GELDIN, T0)!.getTime() - T0.getTime()).toBe(7 * GUN);
    expect(kuponBitisi(AKIS.SEPET_TERKI, T0)!.getTime() - T0.getTime()).toBe(48 * SAAT);
    expect(kuponBitisi(AKIS.CHECKOUT_TERKI, T0)!.getTime() - T0.getTime()).toBe(48 * SAAT);
  });

  it('geçerli kupon kabul edilir', () => {
    expect(kuponGecerliMi({ bitisAni: new Date(T0.getTime() + SAAT), kullanildiAni: null }, T0)).toBe(true);
  });

  it('NEGATİF: KULLANILMIŞ kupon bir daha geçmez (tek kullanım)', () => {
    expect(kuponGecerliMi({ bitisAni: new Date(T0.getTime() + 10 * GUN), kullanildiAni: T0 }, T0)).toBe(false);
  });

  it('NEGATİF: süresi geçmiş kupon geçmez', () => {
    expect(kuponGecerliMi({ bitisAni: new Date(T0.getTime() - 1), kullanildiAni: null }, T0)).toBe(false);
  });

  it('NEGATİF: kupon yoksa geçerli DEĞİL (sessiz true dönmez)', () => {
    expect(kuponGecerliMi(null, T0)).toBe(false);
    expect(kuponGecerliMi(undefined, T0)).toBe(false);
  });

  it('ÇİVİ: kod üretimi Math.random KULLANMAZ — tahmin edilebilir kod tek kullanımı anlamsız kılar', () => {
    const kaynak = readFileSync(new URL('../src/lib/eposta-akis.ts', import.meta.url), 'utf8');
    const kodsuz = kaynak.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(kodsuz).not.toMatch(/Math\.random/);
  });
});

describe('İYS — SMS yalnız onay varsa', () => {
  it('onaylı kişide SMS adımı SMS gider', () => {
    expect(kanalSec(true, true)).toBe('sms');
  });

  it('NEGATİF: onay YOKSA SMS adımı e-postaya düşer — izinsiz SMS GİTMEZ', () => {
    expect(kanalSec(true, false)).toBe('eposta');
  });

  it('SMS olmayan adım onaylı kişide de e-postadır', () => {
    expect(kanalSec(false, true)).toBe('eposta');
  });

  it('sadece sepet terki 3. adımı SMS adayıdır — başka adım SMS istemez', () => {
    const smsAdimlari = Object.entries(ADIMLAR).flatMap(([akis, adimlar]) =>
      adimlar.filter((a) => a.sms).map((a) => `${akis}#${a.adim}`),
    );
    expect(smsAdimlari).toEqual(['sepet_terki#3']);
  });
});

describe('Şema çivisi — defter kuyruğa güvenmez', () => {
  const sema = readFileSync(new URL('../src/db/schema/eposta-akis.ts', import.meta.url), 'utf8');
  const gocHam = readFileSync(new URL('../drizzle/0031_eposta_akis.sql', import.meta.url), 'utf8');
  /**
   * ⚠ Yorumlar SOYULUR. Bu çivi ilk koşuda kendi açıklama satırımı yakaladı:
   * göçün başlığında "CREATE TYPE kullanılmadı" yazıyor ve ham metinde arama
   * onu KOD sanıyor. Bölge kilidi testlerinde ölçülmüş ders — iddia YÜRÜYEN
   * SQL'e bakar, anlatıya değil.
   */
  const goc = gocHam.replace(/--.*$/gm, '');

  it('(tetik_id, adim) TEKİL — aynı adım iki kez gönderilemez', () => {
    expect(sema).toMatch(/unique\('eposta_akis_gonderimleri_tetik_adim_uq'\)/);
    expect(goc).toMatch(/UNIQUE \(tetik_id, adim\)/);
  });

  it('NEGATİF: göç CREATE TYPE kullanmaz — 0007 sınıfı tekrar etmez', () => {
    expect(goc, 'Postgres CREATE TYPE IF NOT EXISTS desteklemez; ikinci koşuda deploy kilitlenir')
      .not.toMatch(/CREATE TYPE/i);
  });

  it('göç fikir-tekrarlı: her CREATE TABLE/INDEX IF NOT EXISTS taşır', () => {
    const creates = goc.match(/CREATE (TABLE|INDEX)[^(]*/gi) ?? [];
    expect(creates.length).toBeGreaterThanOrEqual(6);
    for (const c of creates) expect(c, c).toMatch(/IF NOT EXISTS/i);
  });

  it('göç deploy.sh elle listesine KAYITLI — yoksa prod’da hiç koşmaz', () => {
    const deploy = readFileSync(new URL('../scripts/deploy.sh', import.meta.url), 'utf8');
    expect(deploy).toMatch(/0031_eposta_akis/);
  });

  it('kupon kodu ve e-posta 60 gün sorgusu için indekslidir', () => {
    expect(goc).toMatch(/kod\s+text NOT NULL UNIQUE/);
    expect(goc).toMatch(/eposta_kuponlari_email_created_idx/);
  });
});
