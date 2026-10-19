import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backfillArgumanlari } from '@/lib/shopify/backfill-mode';

describe('Shopify ürün geri-doldurma emniyeti', () => {
  it('varsayılan kuru rapor, eski 2 argümanı DAHİL yazma açmaz', () => {
    expect(backfillArgumanlari([])).toEqual({apply:false,limit:null});
    expect(backfillArgumanlari(['2'])).toEqual({apply:false,limit:2});
    expect(backfillArgumanlari(['--limit=250'])).toEqual({apply:false,limit:250});
  });
  it('yazma ancak açık --apply bayrağıyla', () => {
    expect(backfillArgumanlari(['--apply','--limit=10'])).toEqual({apply:true,limit:10});
    expect(() => backfillArgumanlari(['--limit=-1'])).toThrow();
    expect(() => backfillArgumanlari(['--oops'])).toThrow();
  });
  it('gerçek betik ikinci yazma kapısını ve Shopify host kontrolünü korur', () => {
    const src=readFileSync(join(__dirname,'..','scripts','backfill-products.mts'),'utf8');
    expect(src).toContain("MOD.apply && process.env.BACKFILL_ALLOW_WRITE !== '1'");
    expect(src).toContain('if (MOD.apply) {');
    expect(src).toContain("new URL(nextUrl).origin !== new URL(API).origin");
  });
});
