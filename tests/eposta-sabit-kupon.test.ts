/**
 * ÇİVİ — #994057: e-postaya giden indirim kodu SABİT `HOSGELDIN10`'dur.
 *
 * Yunus 16 Eki (birebir): «indirim olarak HOSGELDIN10 kodunu tanımladık …
 * Yeni indirim kodu açmana gerek yok.»
 *
 * Bu çivi üç şeyi birden tutar:
 *  (1) gönderim katmanı SABİT kodu kullanıyor, `k.kod`'u DEĞİL,
 *  (2) kişiye özel üretim altyapısı SİLİNMEDİ (karar geri alınabilir),
 *  (3) bırakılan üç güvence KODDA YAZILI — sessizce kaybolmasın.
 *
 * DAVRANIŞ AYAĞI ayrı dosyada: `tests/eposta-akis-gonderim.test.ts` gerçek
 * gönderim turunu koşuyor ve gövdede HOSGELDIN10 VAR / `HG-` YOK diye ölçüyor.
 */
import { describe, expect, it } from 'vitest';
import { SABIT_KUPON_KODU } from '@/lib/eposta-akis';
import { readFileSync } from 'node:fs';

const oku = (yol: string) =>
  readFileSync(new URL(yol, import.meta.url), 'utf8');
/** Yorumları at — çivi kendi gerekçe metnini saymasın. */
const yorumsuz = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('sabit kupon kodu', () => {
  it('çekirdek sabiti HOSGELDIN10', () => {
    expect(SABIT_KUPON_KODU).toBe('HOSGELDIN10');
  });

  it('gönderim katmanı SABİT kodu kullanıyor, k.kod’u DEĞİL', () => {
    const src = yorumsuz(oku('../src/lib/eposta-akis-gonderim.ts'));
    expect(src).toContain('kod = SABIT_KUPON_KODU;');
    expect(src).not.toContain('kod = k.kod');          // NEGATİF: kişisel kod gönderilmiyor
    expect(src).toContain('kuponAc(');                  // 60 gün freni YERİNDE duruyor
  });

  it('kişiye özel üretim altyapısı SİLİNMEDİ (karar geri alınabilir)', () => {
    const kupon = oku('../src/lib/eposta-kupon.ts');
    expect(kupon).toContain('kuponKoduUret');
    expect(kupon).toContain('export async function kuponAc');
  });

  it('bırakılan üç güvence KODDA YAZILI (sessizce kaybolmasın)', () => {
    const cekirdek = oku('../src/lib/eposta-akis.ts');
    expect(cekirdek).toContain('300 TL TAVANI ARTIK BİZDE DEĞİL');
    expect(cekirdek).toContain('TEK KULLANIMLIK GARANTİSİ YOK');
    expect(cekirdek).toContain('60 GÜN FRENİ YALNIZ E-POSTAYI DURDURUR');
  });
});
