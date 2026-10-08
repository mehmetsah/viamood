/**
 * #993105 — MİKRO AYAĞI: cari/fatura/sevk adresinde il alanı ilçeye düşmesin.
 *
 * OLAY (Yunus, 7 Eki 2026, Shopify #1206): adres "Mersin Yenişehir" iken etikette
 * il VE ilçe ikisi de "Yenişehir" basılıyordu. `aef52da` bunu ETİKET ayağında
 * (fulfillment-service.ts) kapattı — ama AYNI kusur `mikro-sync.ts`'te ÜÇ YERDE
 * daha duruyordu: cariKayit'in Adres1 · FaturaAdresi · SevkAdresi blokları.
 * Yani etiket düzelse bile Mikro'daki cari "Yenişehir / Yenişehir" açılmaya devam
 * ediyor, oradan kesilen fatura ve irsaliye de yanlış il taşıyordu.
 *
 * KURAL: ters isimlendirme ship.district = İL, ship.city = İLÇE
 * (bkz. teslimat-adresi.ts:4-5). İl boşsa alan BOŞ kalır; ilçeden il TÜRETİLMEZ —
 * "Yenişehir" Mersin'de de Bursa'da da Diyarbakır'da da var, tahmin ikinci bir
 * yanlış adres sınıfı doğurur. Yanlış il, boş ilden DAHA zararlıdır.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/lib/server/mikro-sync.ts'), 'utf8');

/** Yalnız KOD satırlarını say — açıklama satırları sahte pozitif üretmesin. */
function kodSatirlari(metin: string): string {
  return metin
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

describe('#993105 Mikro ayağı — il alanı ilçeye düşmez', () => {
  const kod = kodSatirlari(src);

  it('1. hiçbir KOD satırında `ship.district ?? ship.city` geri çekilmesi kalmadı', () => {
    expect(kod).not.toContain('ship.district ?? ship.city');
  });

  it('2. il ve ilçe tek kaynaktan türetiliyor (ilAdi / ilceAdi)', () => {
    expect(kod).toContain('const ilAdi = ship.district?.trim()');
    expect(kod).toContain('const ilceAdi = ship.city?.trim()');
  });

  it('3. üç adres bloğunun HEPSİ (Adres1 + FaturaAdresi + SevkAdresi) ilAdi kullanıyor', () => {
    const sehirler = kod.match(/Sehir: [^,\n]+/g) ?? [];
    expect(sehirler).toHaveLength(3);
    for (const s of sehirler) expect(s).toBe('Sehir: ilAdi');
  });

  it('4. Kasaba (ilçe) alanı ilçeden gelir — ilAdi ile karıştırılmamış', () => {
    const kasabalar = kod.match(/Kasaba: [^,\n]+/g) ?? [];
    expect(kasabalar).toHaveLength(3);
    for (const k of kasabalar) expect(k).toBe('Kasaba: ilceAdi');
  });

  it('5. NEGATİF KANIT: geri çekilme tek bir bloğa geri konsa çivi kırılır', () => {
    const mutant = kodSatirlari(src.replace('Sehir: ilAdi,', "Sehir: ship.district ?? ship.city ?? '',"));
    expect(mutant).not.toBe(kod); // mutasyon gerçekten uygulandı
    expect(mutant).toContain('ship.district ?? ship.city');
    const sehirler = mutant.match(/Sehir: [^,\n]+/g) ?? [];
    expect(sehirler.filter((s) => s === 'Sehir: ilAdi')).toHaveLength(2); // 3 değil → 3. iddia kırılırdı
  });

  it('6. ilçeden il TÜRETME girişimi yok (il için ilçe tablosuna bakılmıyor)', () => {
    expect(kod).not.toMatch(/il\w*\s*=\s*[^\n]*ilceden/i);
    expect(kod).not.toContain('ilAdi = ilceAdi');
  });
});
