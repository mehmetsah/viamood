/**
 * ÇİVİ — DB → Shopify metafield senkronu (#991833-B).
 *
 * A/B NEGATİF AYAK ZORUNLU: senkron kapalıyken Shopify'a istek GİTMEZ, açıkken gider.
 * BOŞ KÜME AYAĞI: son soru silinince metafield BOŞALIR — yoksa silinen soru temada asılı kalır.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  senkronAcikMi, metafieldGovdesi, metafieldGirdisi, yanitHatasi,
  SSS_METAFIELD_NS, SSS_METAFIELD_KEY, SSS_METAFIELD_TIP,
} from '../src/lib/urun-sss-senkron';

const K = (soru: string, cevap: string, sira: number) => ({ soru, cevap, sira });
const GID = 'gid://shopify/Product/10325978808452';

describe('A/B — kill switch', () => {
  it('KAPALI: senkron açık sayılmaz (Shopify çağrısı yapılmaz)', () => {
    expect(senkronAcikMi({})).toBe(false);
    expect(senkronAcikMi({ SSS_METAFIELD_SENKRON: '' })).toBe(false);
    expect(senkronAcikMi({ SSS_METAFIELD_SENKRON: '0' })).toBe(false);
    // ⚠ 'false' dizesi TRUE'ya dönmemeli — bu depoda ölçülmüş z.coerce.boolean tuzağı.
    expect(senkronAcikMi({ SSS_METAFIELD_SENKRON: 'false' }), "'false' açık sayıldı").toBe(false);
    expect(senkronAcikMi({ SSS_METAFIELD_SENKRON: 'true' }), "'true' de açmamalı — yalnız '1'").toBe(false);
  });
  it('AÇIK: yalnız "1" açar', () => {
    expect(senkronAcikMi({ SSS_METAFIELD_SENKRON: '1' })).toBe(true);
    expect(senkronAcikMi({ SSS_METAFIELD_SENKRON: ' 1 ' })).toBe(true);
  });
});

describe('BOŞ KÜME — silinen soru temada asılı kalmaz', () => {
  it('boş liste "[]" yazar, atlamaz', () => {
    expect(metafieldGovdesi([])).toBe('[]');
  });
  it('boş küme de girdi üretir (değer boş DİZE değil, boş DİZİ)', () => {
    const g = metafieldGirdisi(GID, []);
    expect(g.value).toBe('[]');
    expect(g.value, 'boş dize yazılırsa tema JSON çözemez').not.toBe('');
    expect(g.ownerId).toBe(GID);
  });
});

describe('GÖVDE — sıra ve alanlar', () => {
  it('sira artan, eşitlikte Türkçe alfabetik', () => {
    const j = JSON.parse(metafieldGovdesi([K('B sorusu', 'b', 1), K('A sorusu', 'a', 0), K('A ikinci', 'x', 1)]));
    expect(j.map((x: { soru: string }) => x.soru)).toEqual(['A sorusu', 'A ikinci', 'B sorusu']);
  });
  it('sira alanı metafield\'a GİRMEZ (iki yerde sıra tutmak ayrışma üretir)', () => {
    const j = JSON.parse(metafieldGovdesi([K('S', 'C', 3)]));
    expect(Object.keys(j[0]).sort()).toEqual(['cevap', 'soru']);
  });
  it('girdi dizisi DEĞİŞTİRİLMEZ', () => {
    const l = [K('B', 'b', 1), K('A', 'a', 0)];
    const kopya = JSON.parse(JSON.stringify(l));
    metafieldGovdesi(l);
    expect(l).toEqual(kopya);
  });
  it('metafield kimliği sabit: custom.sss · json', () => {
    expect(SSS_METAFIELD_NS).toBe('custom');
    expect(SSS_METAFIELD_KEY).toBe('sss');
    expect(SSS_METAFIELD_TIP).toBe('json');
    const g = metafieldGirdisi(GID, [K('S', 'C', 0)]);
    expect(g.namespace).toBe('custom');
    expect(g.key).toBe('sss');
    expect(g.type).toBe('json');
  });
});

describe('HATA YUTULMAZ — 200 dönen başarısızlık yakalanır', () => {
  it('temiz yanıt null döner', () => {
    expect(yanitHatasi({ data: { metafieldsSet: { userErrors: [] } } })).toBeNull();
  });
  it('userErrors DOLU ise hata döner (HTTP 200 olsa bile)', () => {
    const h = yanitHatasi({ data: { metafieldsSet: { userErrors: [{ field: ['value'], message: 'geçersiz JSON' }] } } });
    expect(h, 'userErrors sessizce yutuldu — admin "kaydedildi" der, tema boş kalır').toMatch(/geçersiz JSON/);
  });
  it('graphql errors yakalanır', () => {
    expect(yanitHatasi({ errors: [{ message: 'yetki yok' }] })).toMatch(/graphql/);
  });
  it('boş yanıt hata sayılır', () => {
    expect(yanitHatasi(null)).toBe('boş yanıt');
  });
});

describe('ÜRÜN KAYNAĞI — kural tek yerde mi', () => {
  const KAYNAK = readFileSync(path.join(__dirname, '..', 'src/lib/urun-sss-senkron.ts'), 'utf8');
  it('boş kümede metafield BOŞALTILIYOR (atlama dalı yok)', () => {
    const yorumsuz = KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    expect(yorumsuz, 'boş kümede erken dönüş var — silinen soru temada kalır').not.toMatch(
      /if\s*\(\s*!?kayitlar[.\s]*(length)?\s*\)\s*return/,
    );
  });
  it('kill switch YALNIZ "1" ile açılıyor', () => {
    expect(KAYNAK).toMatch(/===\s*'1'/);
  });
});
