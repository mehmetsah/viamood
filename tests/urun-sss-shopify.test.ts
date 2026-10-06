/**
 * ÇİVİ — senkron ÇAĞIRAN taraf (#991833-C). Sahte istemciyle ölçülür, ağ yok.
 */
import { describe, it, expect } from 'vitest';
import { sssSenkronla, handleGid } from '../src/lib/urun-sss-shopify';

const K = (soru: string, cevap: string, sira: number) => ({ soru, cevap, sira });
const AYAR = { domain: 'ornek.myshopify.com', token: 'SAHTE', surum: '2025-01' };
const ACIK = { ...AYAR, env: { SSS_METAFIELD_SENKRON: '1' } };
const KAPALI = { ...AYAR, env: {} };

/** Çağrıları sayan sahte fetch. */
function sahte(yanitlar: unknown[]) {
  const cagrilar: Array<{ url: string; govde: unknown }> = [];
  let i = 0;
  const getir = async (url: string, init: RequestInit) => {
    cagrilar.push({ url, govde: JSON.parse(String(init.body)) });
    const y = yanitlar[Math.min(i++, yanitlar.length - 1)];
    return { json: async () => y } as Response;
  };
  return { getir, cagrilar };
}
const GID_YANIT = { data: { productByHandle: { id: 'gid://shopify/Product/1' } } };
const OK_YANIT = { data: { metafieldsSet: { metafields: [{ namespace: 'custom', key: 'sss' }], userErrors: [] } } };

describe('A/B — kill switch KAPALIYKEN HİÇBİR ağ çağrısı yok', () => {
  it('kapalı: 0 çağrı, ok:true + atlandi', async () => {
    const s = sahte([GID_YANIT, OK_YANIT]);
    const r = await sssSenkronla('urun-a', [K('S', 'C', 0)], { ...KAPALI, getir: s.getir });
    expect(r).toEqual({ ok: true, atlandi: 'kapali' });
    expect(s.cagrilar.length, 'kill switch kapalıyken Shopify\'a istek gitti').toBe(0);
  });
  it('açık: çağrı YAPILIR (2 adım — handle→gid, sonra metafieldsSet)', async () => {
    const s = sahte([GID_YANIT, OK_YANIT]);
    const r = await sssSenkronla('urun-a', [K('S', 'C', 0)], { ...ACIK, getir: s.getir });
    expect(r).toEqual({ ok: true, yazilan: 1 });
    expect(s.cagrilar.length).toBe(2);
  });
});

describe('HATA YUTULMAZ — admin sebebi görür', () => {
  it('handle bulunamazsa ok:false ve handle adı hatada geçer', async () => {
    const s = sahte([{ data: { productByHandle: null } }]);
    const r = await sssSenkronla('olmayan-urun', [K('S', 'C', 0)], { ...ACIK, getir: s.getir });
    expect(r.ok).toBe(false);
    expect('hata' in r && r.hata, 'handle bulunamadı hatası yutuldu').toMatch(/olmayan-urun/);
    expect(s.cagrilar.length, 'gid yokken yine de metafieldsSet çağrıldı').toBe(1);
  });
  it('userErrors dolarsa ok:false (HTTP 200 olsa bile)', async () => {
    const s = sahte([GID_YANIT, { data: { metafieldsSet: { metafields: [], userErrors: [{ field: ['value'], message: 'geçersiz JSON' }] } } }]);
    const r = await sssSenkronla('urun-a', [K('S', 'C', 0)], { ...ACIK, getir: s.getir });
    expect(r.ok).toBe(false);
    expect('hata' in r && r.hata).toMatch(/geçersiz JSON/);
  });
  it('ağ patlarsa ok:false, istisna DIŞARI SIZMAZ', async () => {
    const getir = async () => { throw new Error('ECONNRESET'); };
    const r = await sssSenkronla('urun-a', [K('S', 'C', 0)], { ...ACIK, getir });
    expect(r.ok).toBe(false);
    expect('hata' in r && r.hata).toMatch(/ECONNRESET/);
  });
  it('boş handle ok:false, ağ çağrısı yok', async () => {
    const s = sahte([GID_YANIT]);
    const r = await sssSenkronla('', [K('S', 'C', 0)], { ...ACIK, getir: s.getir });
    expect(r.ok).toBe(false);
    expect(s.cagrilar.length).toBe(0);
  });
});

describe('BOŞ KÜME — metafield boşalır, sira sızmaz', () => {
  it('silme sonrası boş küme "[]" gönderir (atlamaz)', async () => {
    const s = sahte([GID_YANIT, OK_YANIT]);
    const r = await sssSenkronla('urun-a', [], { ...ACIK, getir: s.getir });
    expect(r).toEqual({ ok: true, yazilan: 0 });
    const g = s.cagrilar[1]!.govde as { variables: { m: Array<{ value: string }> } };
    expect(g.variables.m[0]!.value, 'boş kümede metafield boşaltılmadı').toBe('[]');
  });
  it('gönderilen gövdede `sira` alanı YOK', async () => {
    const s = sahte([GID_YANIT, OK_YANIT]);
    await sssSenkronla('urun-a', [K('S1', 'C1', 5), K('S0', 'C0', 0)], { ...ACIK, getir: s.getir });
    const g = s.cagrilar[1]!.govde as { variables: { m: Array<{ value: string; type: string }> } };
    const liste = JSON.parse(g.variables.m[0]!.value) as Array<Record<string, unknown>>;
    expect(g.variables.m[0]!.type).toBe('json');
    expect(liste.map((x) => x.soru)).toEqual(['S0', 'S1']);
    for (const x of liste) expect(Object.keys(x).sort()).toEqual(['cevap', 'soru']);
  });
});

describe('handleGid', () => {
  it('bulunursa gid, bulunamazsa null', async () => {
    expect(await handleGid('a', { ...AYAR, getir: sahte([GID_YANIT]).getir })).toBe('gid://shopify/Product/1');
    expect(await handleGid('a', { ...AYAR, getir: sahte([{ data: { productByHandle: null } }]).getir })).toBeNull();
  });
});
