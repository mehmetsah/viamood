/**
 * Halköde callback — sağlayıcı hatası GÜNLÜĞE DÜŞMELİ.
 *
 * ÖLÇÜLMÜŞ ARIZA (25 Eyl 2026): out.log son 60 satırda 2 kez `bankError: undefined`.
 * Sebep: kod `p.original_bank_error_code` okuyordu, ama Halköde dönüşünde gelen
 * alanlar (nginx access, 12:44:58 UTC) şunlardı:
 *   invoice_id · status_code · error_code · status_description · transaction_type
 *   payment_status · payment_method · pos_bank · hash_key
 * `original_bank_error_code` HİÇ GELMİYOR → sağlayıcının gerçek hatası
 * ("The total of your items price … is not equal to …") günlükte hiç görünmüyordu.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KAYNAK = readFileSync(
  path.resolve(__dirname, '../src/app/api/v1/payment/halkode/callback/route.ts'),
  'utf8',
);

/** Kaynaktaki `saglayiciHata` ifadesini gerçek Halköde yanıtıyla çalıştırır. */
function oku(p: Record<string, string>): string {
  const m = KAYNAK.match(/const saglayiciHata =\s*([\s\S]*?);/);
  expect(m, 'saglayiciHata tanımı bulunamadı').toBeTruthy();
  return new Function('p', `return ${m![1]};`)(p) as string;
}

// 25 Eyl 12:44:58 UTC callback'inde GERÇEKTEN gelen alanlar (hash_key kasten yok).
const GERCEK_YANIT = {
  invoice_id: 'vm1301266759812tmugydydd',
  status_code: '13',
  error_code: '13',
  status_description: 'The total of your items price 8100.0000 is not equal to the invoice total (8100.0000)',
  transaction_type: 'Auth',
  payment_status: '0',
  payment_method: '1',
  pos_bank: 'T. VAKIFLAR BANKASI T.A.O.',
};

describe('callback sağlayıcı hatası', () => {
  it('gerçek Halköde yanıtından hata okunuyor — undefined DEĞİL', () => {
    const h = oku(GERCEK_YANIT);
    expect(h, 'sağlayıcı hatası okunamadı').toBeTruthy();
    expect(h).not.toBe('undefined');
    expect(String(h)).toContain('13');
  });

  it('status_description yalnız başına gelse de okunur', () => {
    expect(oku({ status_description: 'Insufficient funds' })).toBe('Insufficient funds');
  });

  it('eski alan adı hâlâ destekleniyor (geriye uyum)', () => {
    expect(oku({ original_bank_error_code: '05', error_code: '99' })).toBe('05');
  });

  it('NEGATİF: alanların hiçbiri yoksa boş döner (undefined değil)', () => {
    expect(oku({ invoice_id: 'x' })).toBe('');
  });

  it('DEĞİŞMEZ: günlük satırı artık tek alana bağlı değil', () => {
    expect(KAYNAK, 'eski tek-alan kalıbı geri gelmiş').not.toMatch(
      /bankError:\s*p\.original_bank_error_code\s*,/,
    );
    expect(KAYNAK).toContain('bankError: saglayiciHata');
    expect(KAYNAK).toContain('bankaHata: saglayiciHata');
  });

  it('müşteriye giden sayfa durum kodu + referans taşıyor', () => {
    expect(KAYNAK).toMatch(/reason:\s*`halkode:\$\{reason\}`/);
    expect(KAYNAK).toMatch(/q\.set\('ref',\s*invoiceId\)/);
  });

  it('kart alanı günlüğe yazılmıyor', () => {
    // Yorumlar ölçülmez: yasağı ANLATAN yorum yasağı ihlal etmiş sayılmasın
    // (kaynakta "KART ALANI LOGLANMAZ (`credit_card_no` vb. bilerek yok)" yazıyor).
    const kod = KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    expect(kod).not.toMatch(/credit_card_no|cc_no|cvv/);
  });
});
