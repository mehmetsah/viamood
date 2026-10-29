/**
 * #995332 · ayse:802 · KART GÖRSELİ YAMA PAKETİ ÇİVİSİ.
 * Paket (ÖNCESİ → SONRASI) md5'leri, tek script satırı, kap oranına dokunulmadığı,
 * yeni renk eklenmediği ve betiğin kapatma anahtarı (via_kirp=0) ölçülür.
 * MUTASYON: ek-blok.css'e `aspect-ratio` ya da bir renk yazılırsa ya da betikten
 * `via_kirp=0` kapısı silinirse ilgili iddia KIRILIR.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const P = path.join(__dirname, '..', 'tema-yamalari', '995332-kart-gorsel');
const oku = (f: string) => readFileSync(path.join(P, f), 'utf8');
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const M = JSON.parse(oku('md5.json')) as Record<string, { once: string | null; sonra: string }>;

describe('#995332 kart görseli yama paketi', () => {
  it('ÖNCESİ/SONRASI/YENİ dosyaları md5.json ile birebir', () => {
    for (const k of ['layout/theme.liquid', 'assets/via-product-overrides.css', 'sections/via-koleksiyon-v2.liquid']) {
      const f = k.replace('/', '__');
      expect(md5(oku(`ONCESI/${f}`))).toBe(M[k]!.once);
      expect(md5(oku(`SONRASI/${f}`))).toBe(M[k]!.sonra);
    }
    expect(M['assets/via-kart-gorsel.js']!.once).toBeNull();
    expect(md5(oku('YENI/assets__via-kart-gorsel.js'))).toBe(M['assets/via-kart-gorsel.js']!.sonra);
  });

  it('layout: yalnız TEK script satırı eklenir, başka satır değişmez', () => {
    const once = oku('ONCESI/layout__theme.liquid').split('\n');
    const sonra = oku('SONRASI/layout__theme.liquid').split('\n');
    expect(sonra.length).toBe(once.length + 1);
    const eklenen = sonra.filter((s) => !once.includes(s));
    expect(eklenen).toEqual([`    <script src="{{ 'via-kart-gorsel.js' | asset_url }}" defer></script>`]);
  });

  it('CSS: SONRASI = ÖNCESİ + ek blok; ek blok kap oranına dokunmaz, yeni renk eklemez', () => {
    const ek = oku('ek-blok.css');
    expect(oku('SONRASI/assets__via-product-overrides.css')).toBe(oku('ONCESI/assets__via-product-overrides.css') + ek);
    const kurallar = ek.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(kurallar).toMatch(/object-fit:\s*contain/);
    expect(kurallar).not.toMatch(/aspect-ratio|#[0-9a-f]{3,8}\b|rgb|hsl|var\(--/i);
  });

  it('ayak 2 · koleksiyon kartı: yalnız TEK satır eklenir; oran 2/3 aynen, yeni renk yok', () => {
    const once = oku('ONCESI/sections__via-koleksiyon-v2.liquid').split('\n');
    const sonra = oku('SONRASI/sections__via-koleksiyon-v2.liquid').split('\n');
    expect(sonra.length).toBe(once.length + 1);
    const eklenen = sonra.filter((s) => !once.includes(s));
    expect(eklenen).toHaveLength(1);
    const kural = eklenen[0]!.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(kural).toMatch(/\.vkol2-media img\{object-fit:contain\}/);
    expect(kural).not.toMatch(/aspect-ratio|#[0-9a-f]{3,8}\b|rgb|hsl|var\(--/i);
    expect(sonra.join('\n')).toContain('.vkol2-media{aspect-ratio:2/3;');
  });

  it('betik: kapatma anahtarı, yalnız kart seçicisi, medyaya yazma yok', () => {
    const js = oku('YENI/assets__via-kart-gorsel.js');
    expect(js).toContain('via_kirp=0');
    expect(js).toContain("'.product-card .product-media__image, .vkol2-media img'");
    expect(js).not.toMatch(/fetch\(|XMLHttpRequest|\.src\s*=/);
    expect(js).toMatch(/style\.scale/);
    expect(js).not.toMatch(/style\.transform\s*=/); // tema hover transform'unu ezmez
  });
});
