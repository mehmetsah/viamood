/**
 * #995332 · ayse:802 · KART GÖRSELİ YAMA PAKETİ ÇİVİSİ.
 * Paket (ÖNCESİ → SONRASI) md5'leri, tek script satırı, kap oranına dokunulmadığı,
 * yeni renk eklenmediği ve betiğin kapatma anahtarı (via_kirp=0) ölçülür.
 * MUTASYON: ek-blok.css'e `aspect-ratio` ya da bir renk yazılırsa ya da betikten
 * `via_kirp=0` kapısı silinirse ilgili iddia KIRILIR. E1: betikte `EN_AZ` 1'in altına
 * çekilirse (görsel contain'in altına küçülür → yapay beyaz paspartu) son iddia KIRILIR.
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

  it('tek hâl: kategori ÖNCESİ = #995388 SONRASI (canlıdaki 2/3) — iki paket birbirinden kopamaz', () => {
    const p388 = path.join(__dirname, '..', 'tema-yamalari', '995388-kategori-gorsel');
    const sonra388 = readFileSync(path.join(p388, 'SONRASI', 'sections__via-koleksiyon-v2.liquid'), 'utf8');
    expect(oku('ONCESI/sections__via-koleksiyon-v2.liquid')).toBe(sonra388);
    expect(M['sections/via-koleksiyon-v2.liquid']!.once).toBe(JSON.parse(readFileSync(path.join(p388, 'md5.json'), 'utf8')).sonra);
  });

  it('betik: kapatma anahtarı, yalnız kart seçicisi, medyaya yazma yok', () => {
    const js = oku('YENI/assets__via-kart-gorsel.js');
    expect(js).toContain('via_kirp=0');
    expect(js).toContain("'.product-card .product-media__image, .vkol2-media img'");
    expect(js).not.toMatch(/fetch\(|XMLHttpRequest|\.src\s*=/);
    expect(js).toMatch(/style\.scale/);
    expect(js).not.toMatch(/style\.transform\s*=/); // tema hover transform'unu ezmez
  });

  it('E1 · betik görseli contain\'in altına KÜÇÜLTMEZ (EN_AZ >= 1) — dolu görselde yapay beyaz paspartu yok', () => {
    // 31 Eki ölçümü: EN_AZ = 0.85 iken 141/240 görsel ~%88'e küçüldü, Pola beyaz oranı %3 → %25.
    const js = oku('YENI/assets__via-kart-gorsel.js');
    const tanim = [...js.matchAll(/\bEN_AZ\s*=\s*([0-9.]+)/g)];
    expect(tanim).toHaveLength(1);
    expect(Number(tanim[0]![1])).toBeGreaterThanOrEqual(1);
    expect(js).toMatch(/s\s*=\s*Math\.max\(EN_AZ,\s*Math\.min\(EN_COK,\s*s\)\)/); // alt sınır gerçekten uygulanıyor
  });
});
