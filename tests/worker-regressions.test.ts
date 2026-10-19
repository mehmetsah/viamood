import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { desteklenmeyenIs, epostaIsiDogrula, siparisIdDogrula } from '@/worker/validators';

describe('gerçek worker sözleşmeleri', () => {
  const ID = '123e4567-e89b-42d3-a456-426614174000';
  it('routing yalnız UUID orderId ile işlenir', () => {
    expect(siparisIdDogrula({orderId: ID})).toBe(ID);
    expect(() => siparisIdDogrula({orderId:'abc'})).toThrow(/UUID/);
    expect(() => siparisIdDogrula({})).toThrow(/UUID/);
  });
  it('işlemsel e-postada alan ve mail tipi gerekli, ticari iletide izin zorunlu', () => {
    const p={to:'musteri@example.com',subject:'Sipariş',html:'<p>Merhaba</p>'};
    expect(epostaIsiDogrula({...p,tip:'islemsel'}).tip).toBe('islemsel');
    expect(() => epostaIsiDogrula(p)).toThrow(/mail tipi/);
    expect(() => epostaIsiDogrula({...p,tip:'pazarlama'})).toThrow(/izin/);
    expect(epostaIsiDogrula({...p,tip:'pazarlama',iysOnayi:true}).tip).toBe('pazarlama');
    expect(() => epostaIsiDogrula({...p,to:'test',tip:'islemsel'})).toThrow(/alıcı/);
  });
  it('desteklenmeyen işler başarılı taklidi yapmaz', () => {
    expect(() => desteklenmeyenIs('payout')).toThrow(/sahte başarı/);
    const src=readFileSync(join(__dirname,'..','src','worker','index.ts'),'utf8');
    expect(src).toContain('await routeOrder(orderId)');
    expect(src).toContain('await sendEmail(p)');
    expect(src).not.toContain('return { paid: true }');
    expect(src).not.toContain('return { labelCreated: true }');
  });
  it('Shopify ingest hatası 200 ile sessizce düşürülmez', () => {
    const src=readFileSync(join(__dirname,'..','src','app','api','shopify','webhooks','route.ts'),'utf8');
    expect(src).toContain("status: 503");
    expect(src).not.toContain("status: 200 }); // 200 ki retry olmasın");
  });
});
