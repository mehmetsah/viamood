import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const src=readFileSync(join(__dirname,'..','tema-yamalari','via-varyasyon-yatay.994753-P1'),'utf8');
describe('ViaMood varyasyon secici CSS onizleme',()=>{
  it('sadece yatay gorunume dokunur, JS radio secimine dokunmaz',()=>{
    expect(src).toContain('.vqb__group');
    expect(src).toContain('.vqb__card');
    expect(src).toContain('minmax(0, 1fr)');
    expect(src).toContain('min-width: 0;');
    expect(src).not.toContain('display: none');
    expect(src).not.toMatch(/\.vqb__card\s*\{[^}]*pointer-events:\s*none/s);
  });
});
