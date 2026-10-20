import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const file = readFileSync(join(__dirname, '..', 'tema-yamalari', 'via-product-tabs.liquid.CANLI-SSS-SONRASI'), 'utf8');
describe('Shopify ürün SSS sekmesi — iki besleme yolu', () => {
  it('metafield yokken yalnız açık public API kayıtlarını getiren fallback vardır', () => {
    expect(file).toContain('product.metafields.custom.sss.value');
    expect(file).toContain('/api/v1/urun-sss?handle=');
    expect(file).toContain("credentials: 'omit'");
    expect(file).toContain('data.ok && Array.isArray(data.sss)');
  });
  it('vp-tabbed olsa bile SSS daha önce eklenmediyse ekler', () => {
    expect(file).not.toContain("if (!root || root.classList.contains('vp-tabbed')) return;");
    expect(file.indexOf('sssEkle(sssRoot, sss);')).toBeLessThan(file.indexOf("if (root.classList.contains('vp-tabbed')) return;"));
    expect(file).toContain("root.querySelector('[data-vm-sss]')");
    expect(file).toContain('btn.addEventListener');
  });
  it('soru ve cevapları HTML olarak enjekte etmez', () => {
    expect(file).toContain('b.textContent = k.soru');
    expect(file).toContain('a.textContent = k.cevap');
  });
});
