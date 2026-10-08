/**
 * #992928 — ANA FİRMA (VIA) bacağı mutabakat çivisi.
 *
 * OLAY (Yunus, 5 Eki 2026): "Shopify siparişleri 17 Eylül'den itibaren Mikro'daki VIA
 * firmasına aktarılmamış ama aradepo (BERCYEDEK) firmasına aktarılmış."
 *
 * KÖK SEBEP: `syncOrderToMikro` girişinde KOŞULSUZ bir erken çıkış vardı —
 * `mikroSyncStatus === 'approved'` ise fonksiyon hemen dönüyordu. Oysa o statü
 * ARADEPO bacağı başarılı olur olmaz yazılıyor; ANA FİRMA bacağı (`pushToFirmaDb`)
 * ondan SONRA best-effort çalışıyor ve hatası yalnız `console.error`'a gidiyordu.
 * Sonuç: firma bacağı bir kez düştüğünde bir daha ASLA denenemiyordu (fulfillment
 * sonrası re-sync de bu satırda geri dönüyordu) ve sipariş statüsü 'approved'
 * olduğu için dışarıdan "tamam" görünüyordu.
 *
 * NEDEN KAYNAK BİÇİMİ ÇİVİSİ: bu onarım 1 Eyl 2026'da `aa5af54` ile BİR KEZ yazıldı,
 * main'e HİÇ inmedi ve yalnız yedek ref'lerde kaldı — yani asıl regresyon sınıfı
 * "mantık yanlış çalıştı" değil, "doğru kod ağaçtan düştü". Bu çivi tam olarak
 * onu yakalar: koşulsuz erken çıkış geri gelirse ya da hata yutmaya dönerse kırılır.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KAYNAK = join(process.cwd(), 'src/lib/server/mikro-sync.ts');
const src = readFileSync(KAYNAK, 'utf8');

/** Erken çıkış kalıbı: `approved` kontrolünü hemen izleyen, pushToFirmaDb İÇERMEYEN return bloğu. */
function kosulsuzErkenCikisVarMi(metin: string): boolean {
  const re = /mikroSyncStatus === 'approved'\s*\)\s*\{([\s\S]*?)\n\s{2}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(metin))) {
    const govde = m[1]!;
    if (govde.includes('return') && !govde.includes('pushToFirmaDb')) return true;
  }
  return false;
}

describe("#992928 — 'approved' erken çıkışı firma bacağını mühürlemesin", () => {
  it('1. kaynakta hâlâ bir approved dalı var (blok silinmedi, davranışı değişti)', () => {
    expect(src).toContain("mikroSyncStatus === 'approved'");
  });

  it('2. approved dalı pushToFirmaDb ÇAĞIRIR — koşulsuz return YOK', () => {
    expect(kosulsuzErkenCikisVarMi(src)).toBe(false);
  });

  it('3. NEGATİF KANIT: koşulsuz erken çıkış geri konsa çivi kırılır', () => {
    const mutant = src.replace(
      /if \(order\.mikroSyncStatus === 'approved'\) \{/,
      "if (order.mikroSyncStatus === 'approved') {\n    return { ok: true, orderId, cariKodu: '', evrakSeri: '', evrakSira: 1, status: 'approved' };\n  }\n  if (false) {",
    );
    expect(mutant).not.toBe(src); // mutasyon gerçekten uygulandı
    expect(kosulsuzErkenCikisVarMi(mutant)).toBe(true);
  });

  it('4. firma bacağı hatası KALICI kaydedilir (mikroError), yalnız console değil', () => {
    expect(src).toContain('async function kaydetFirmaHatasi(');
    const yardimci = src.slice(src.indexOf('async function kaydetFirmaHatasi('));
    expect(yardimci.slice(0, 1200)).toContain('mikroError');
  });

  it('5. firma push hatasının hiçbir çağrı yerinde "yalnız console.error" yutması kalmadı', () => {
    const yutan = src.match(/if \(!firma\w*\.ok\) console\.error/g) ?? [];
    expect(yutan).toHaveLength(0);
  });

  it('6. firma push hatasının her çağrı yeri kaydetFirmaHatasi\'na bağlı', () => {
    const kontroller = src.match(/if \(!firma\w*\.ok\)[^\n]*/g) ?? [];
    expect(kontroller.length).toBeGreaterThanOrEqual(3); // ana yol + dup-dalı + mutabakat
    for (const k of kontroller) expect(k).toContain('kaydetFirmaHatasi');
  });

  it('7. mutabakat dalı aradepo evrağını TEKRAR YAZMAZ (siparisEkle içermez)', () => {
    const i = src.indexOf("if (order.mikroSyncStatus === 'approved') {");
    expect(i).toBeGreaterThan(-1);
    const blok = src.slice(i, src.indexOf('\n  }', i));
    expect(blok).toContain('pushToFirmaDb');
    expect(blok).not.toContain('siparisEkle');
  });
});
