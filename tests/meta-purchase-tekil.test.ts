/**
 * ÇİVİ — Purchase TEKİLLEŞTİRME (#991406). Görev şartı: "sayfa yenilenince ikinci
 * Purchase DOĞMAMALI — bunu iddia eden ölçüm/kanıt yaz."
 *
 * Mükerrer Purchase'ın bedeli ölçülebilir: Meta'da ciro iki katı görünür, reklam
 * optimizasyonu yanlış sinyalle eğitilir.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { purchaseEventId, purchaseDamgaAnahtari, purchaseGonderilmeli } from '../src/lib/meta/purchase-tekil';

/** localStorage taklidi — gerçek tarayıcı deposu yok, davranış birebir. */
function depo(baslangic: Record<string, string> = {}) {
  const m = new Map(Object.entries(baslangic));
  return {
    oku: (k: string) => (m.has(k) ? m.get(k)! : null),
    yaz: (k: string, v: string) => void m.set(k, v),
    boyut: () => m.size,
  };
}

describe('SAYFA YENİLENİNCE ikinci Purchase doğmaz', () => {
  it('ilk gönderim EVET, damga yazıldıktan sonra HAYIR', () => {
    const d = depo();
    const kod = '1234';
    expect(purchaseGonderilmeli(kod, 41000, d.oku), 'ilk Purchase engellendi').toBe(true);
    d.yaz(purchaseDamgaAnahtari(kod), String(Date.now()));
    expect(purchaseGonderilmeli(kod, 41000, d.oku), 'YENİLEMEDE İKİNCİ PURCHASE DOĞDU — ciro iki katı').toBe(false);
  });

  it('üçüncü, dördüncü yenileme de göndermez (damga kalıcı)', () => {
    const d = depo({ [purchaseDamgaAnahtari('1234')]: '1' });
    for (let i = 0; i < 4; i++) expect(purchaseGonderilmeli('1234', 41000, d.oku)).toBe(false);
  });

  it('BAŞKA sipariş engellenmez — damga sipariş bazlı', () => {
    const d = depo({ [purchaseDamgaAnahtari('1234')]: '1' });
    expect(purchaseGonderilmeli('1235', 41000, d.oku)).toBe(true);
  });

  it('# öneki damgayı ve eventID\'yi AYRIŞTIRMAZ (order_name "#1234" gelebilir)', () => {
    expect(purchaseDamgaAnahtari('#1234')).toBe(purchaseDamgaAnahtari('1234'));
    expect(purchaseEventId('#1234')).toBe(purchaseEventId('1234'));
    const d = depo({ [purchaseDamgaAnahtari('1234')]: '1' });
    expect(purchaseGonderilmeli('#1234', 41000, d.oku), '# ile gelen kod ikinci kez gönderiyor').toBe(false);
  });
});

describe('damga KARARLI olmalı — aynı sipariş aynı anahtar', () => {
  it('iki çağrı aynı anahtarı verir (zaman/rastgele karışmaz)', () => {
    // ⚠ ÖLÇÜLDÜ: önceki iddia bunu YAKALAMIYORDU — anahtara Date.now() eklemek
    // mutasyonu çıkış 0 verdi, çünkü testler damgayı hemen yazıp hemen okuyordu.
    // Anahtar zamana bağlıysa yenilemede damga BULUNAMAZ ve Purchase ikinci kez doğar.
    const a = purchaseDamgaAnahtari('1234');
    const b = purchaseDamgaAnahtari('1234');
    expect(a).toBe(b);
    expect(a).toBe('vm_fb_purchase_1234');
    expect(a, 'anahtara zaman damgası karışmış').not.toMatch(/\d{10,}$/);
  });

  it('yazılan damga SONRADAN okunabiliyor (gerçek yenileme senaryosu)', () => {
    const m = new Map<string, string>();
    const yaz = (k: string) => void m.set(k, '1');
    const oku = (k: string) => m.get(k) ?? null;
    // 1. istek: gönder + damgala
    expect(purchaseGonderilmeli('1234', 41000, oku)).toBe(true);
    yaz(purchaseDamgaAnahtari('1234'));
    // 2. istek (sayfa yenilendi): anahtar AYNI türetilmeli, yoksa damga bulunamaz
    expect(purchaseGonderilmeli('1234', 41000, oku)).toBe(false);
  });
});

describe('eventID — Meta deduplication anahtarı', () => {
  it('sipariş kodundan türetilir, sabit', () => {
    expect(purchaseEventId('1234')).toBe('vmp-1234');
    expect(purchaseEventId('1234')).toBe(purchaseEventId('1234'));
  });
  it('kod yoksa boş — imzasız olay gönderilmesin', () => {
    expect(purchaseEventId('')).toBe('');
    expect(purchaseDamgaAnahtari('   ')).toBe('');
  });
});

describe('DEĞER KAPISI — değersiz Purchase gitmez', () => {
  const d = depo();
  it('0, negatif, NaN ve Infinity reddedilir', () => {
    for (const v of [0, -1, NaN, Infinity, -Infinity]) {
      expect(purchaseGonderilmeli('1234', v, d.oku), `tutar ${v} geçti`).toBe(false);
    }
  });
  it('1 kuruş bile geçerli (alt sınır yapay değil)', () => {
    expect(purchaseGonderilmeli('1234', 1, d.oku)).toBe(true);
  });
  it('kod yoksa gönderilmez', () => {
    expect(purchaseGonderilmeli('', 41000, d.oku)).toBe(false);
  });
});

describe('DEPO KAPALIYSA — eksik ölçüm, yanlış ölçümden iyidir', () => {
  it('localStorage fırlatırsa olay GÖNDERİLİR (Meta eventID ile tekilleştirir)', () => {
    const patlayan = () => { throw new Error('SecurityError: gizli sekme'); };
    expect(purchaseGonderilmeli('1234', 41000, patlayan)).toBe(true);
  });
});

describe('TEMA YAMASI aynı kuralı yazıyor mu (kopya sapmasın)', () => {
  const YAMA = readFileSync(
    path.join(__dirname, '..', 'tema-yamalari/via-checkout.liquid.meta-initiate-purchase'),
    'utf8',
  );

  it('eventID yamada da vmp- önekiyle', () => {
    expect(YAMA).toMatch(/eventID:\s*'vmp-'\s*\+\s*k/);
  });

  it('damga localStorage\'da — sessionStorage DEĞİL', () => {
    expect(YAMA).toMatch(/localStorage\.getItem\(damga\)/);
    expect(YAMA).toMatch(/localStorage\.setItem\(damga/);
    // Negatif: sessionStorage'a dönerse sekme kapanınca olay ikinci kez doğar.
    expect(YAMA, 'damga sessionStorage\'a taşınmış — yenilemede mükerrer Purchase').not.toMatch(
      /sessionStorage\.(get|set)Item\(damga/,
    );
  });

  it('item_price BİRİM fiyat (satır toplamı değil)', () => {
    expect(YAMA).toMatch(/item_price:\s*Math\.round\(i\.line_price \/ i\.quantity\)\s*\/\s*100/);
    expect(YAMA).not.toMatch(/item_price:\s*i\.line_price\s*\/\s*100/);
  });

  it('currency TRY sabit ve değersiz olay kapısı var', () => {
    expect(YAMA).toMatch(/currency:\s*'TRY'/);
    expect(YAMA).toMatch(/value <= 0\) return null/);
  });

  it('CANLI TEMAYA UYGULANMADI diye işaretli (karar Mehmet Şah\'ta)', () => {
    expect(YAMA).toMatch(/UYGULANMADI/);
  });
});
