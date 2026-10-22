/**
 * ÇİVİ — #994057 → #994816: SABİT `HOSGELDIN10` YOLU KALDIRILDI (geri gelmesin).
 *
 * Tarihçe: Yunus 16 Eki «HOSGELDIN10 kodunu direk gönderebilirsin» demişti; bu
 * çivi o kararı tutuyordu. Yunus 21 Eki 10:19'da spec'i bu not OLMADAN yeniden
 * gönderdi («Tüm kodlar kişiye özel ve tek kullanımlık olmalı») ve gruba kişiye
 * özel kod taahhüdü verildi. Dosya ezme kapısı gereği SİLİNMEDİ, tersine çevrildi:
 * artık sabit kodun gönderim katmanına GERİ DÖNMEDİĞİNİ ölçer.
 * Davranış ayağı: tests/eposta-akis-gonderim.test.ts (gövdede HG- VAR, HOSGELDIN10 YOK)
 * ve tests/eposta-akis-islak.test.ts (gerçek Postgres, kişiye özel kod tekil).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as cekirdek from '@/lib/eposta-akis';

const oku = (yol: string) => readFileSync(new URL(yol, import.meta.url), 'utf8');
/** Yorumları at — çivi kendi gerekçe metnini saymasın. */
const yorumsuz = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('sabit kupon kodu KALDIRILDI', () => {
  it('çekirdek artık SABIT_KUPON_KODU dışa aktarmıyor', () => {
    expect((cekirdek as Record<string, unknown>).SABIT_KUPON_KODU).toBeUndefined();
  });
  it('gönderim katmanı kişiye özel kodu (k.kod) kullanıyor', () => {
    const src = yorumsuz(oku('../src/lib/eposta-akis-gonderim.ts'));
    expect(src).toContain('kod = k.kod;');
    expect(src).not.toContain('SABIT_KUPON_KODU');
    expect(src).not.toContain('HOSGELDIN10');
  });
  it('kişiye özel üretim altyapısı yerinde', () => {
    const kupon = oku('../src/lib/eposta-kupon.ts');
    expect(kupon).toContain('kuponKoduUret');
    expect(kupon).toContain('export async function kuponAc');
  });
});
