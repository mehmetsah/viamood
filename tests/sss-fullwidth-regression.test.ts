import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
const theme = readFileSync(join(__dirname,'..','tema-yamalari','via-product-tabs.liquid.CANLI-SSS-SONRASI'),'utf8');
describe('SSS full-width yerlesim gerilemesi',()=>{
  it('sekme DOM altina tasininca root disindan SSS ekler',()=>{
    expect(theme).toContain("var sssRoot = document.querySelector('.vm-tabs-fw') || root;");
    expect(theme).toContain("sssEkle(document.querySelector('.vm-tabs-fw') || root, data.sss)");
  });
  it('sonradan gelen ajax yaniti nav kapsayicisini bulur',()=>{
    expect(theme).toContain("if (fw && fw.contains(dt)) nav = fw.querySelector('.vp-tabnav');");
  });
  it('DOM yonetimi ve metin guvenli',()=>{
    expect(theme).toContain('a.textContent = k.cevap;');
    expect(theme).toContain('b.textContent = k.soru;');
  });
});
