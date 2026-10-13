/**
 * ÇİVİ — #994052: slider altındaki siyah bilgilendirme şeridi MOBİLDE görünmez.
 *
 * NEDEN VAR: 13 Eki 2026 ölçümü — CANLI sitede `@media(max-width:720px)
 * .vmh2-benefit-strip{display:none}` vardı ama DEPO yamasında YOKTU. Depo sürümü
 * uygulansaydı Volkan'ın şikâyet ettiği siyah şerit mobilde geri gelirdi.
 * Bu çivi o mayının yeniden açılmasını engeller.
 *
 * ⚠ Ölçüm YORUM ÜZERİNDE YAPILMAZ: aşağıdaki `kodSatirlari()` CSS yorumlarını
 *   söker. (Bu depoda "çivi kendi açıklamasını sayıyor" sınıfı daha önce ölçüldü.)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const YAMA = join(__dirname, '..', 'tema-yamalari', 'via-mood-home-v2.liquid.992999-mobil-izgara-tasmasi');
const ham = readFileSync(YAMA, 'utf8');

/** CSS/Liquid yorumlarını söker — yalnız çalışan bildirimler kalır. */
function kodSatirlari(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{%-?\s*comment[\s\S]*?endcomment\s*-?%\}/g, '');
}
const kod = kodSatirlari(ham);

/** `@media (max-width:720px){ ... }` bloğunun gövdesini çıkarır (son/mobil kırılım). */
function mobilBlok(): string {
  const idx: number[] = [];
  const re = /@media\s*\(max-width:\s*720px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(kod))) idx.push(m.index + m[0].length);
  expect(idx.length).toBeGreaterThan(0);
  const bas = idx[idx.length - 1];           // şerit kuralı en son 720px bloğunda
  let derinlik = 1, i = bas;
  while (i < kod.length && derinlik > 0) {
    if (kod[i] === '{') derinlik++;
    else if (kod[i] === '}') derinlik--;
    i++;
  }
  return kod.slice(bas, i);
}

describe('#994052 — mobilde siyah bilgilendirme şeridi', () => {
  const blok = mobilBlok();

  it('mobil kırılımda şerit display:none ile kapatılıyor', () => {
    expect(/\.vmh2-benefit-strip\s*\{[^}]*display:\s*none/.test(blok)).toBe(true);
  });

  it('kapatma MOBİL kırılımın İÇİNDE — masaüstünde şerit duruyor', () => {
    // 720px bloğunun dışındaki ana tanım hâlâ görünür bir grid olmalı
    const anaTanim = kod.match(/\.vmh2-benefit-strip\{width:var\(--vmh2-container\)[^}]*\}/);
    expect(anaTanim).not.toBeNull();
    expect(anaTanim![0]).toContain('display:grid');
    expect(anaTanim![0]).not.toContain('display:none');
  });

  it('mobil blokta şeridi TEKRAR gösteren bir kural YOK (negatif güvence)', () => {
    const tersler = blok.match(/\.vmh2-benefit-strip\s*\{[^}]*display:\s*(grid|flex|block)/g);
    expect(tersler).toBeNull();
  });

  it('masaüstü 4 sütun düzeni bozulmadı', () => {
    expect(kod).toContain('grid-template-columns:repeat(4,1fr)');
  });

  it('şerit mobilde yeniden açılmak istenirse tek sütun kuralı korunmuş', () => {
    expect(blok).toContain('.vmh2-benefit-strip{grid-template-columns:1fr;padding:22px}');
  });
});
