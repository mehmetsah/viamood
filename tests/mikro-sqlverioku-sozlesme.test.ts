/**
 * #994827 — Mikro `SqlVeriOku` çağrı sözleşmesi.
 *
 * ÖLÇÜLEN ARIZA (22 Eki 2026, prod): VIA firma bacağı 8 Eki 17:38'den beri
 * senkronlanan 40 siparişin 40'ında "Mikro API error: 404" ile düştü. Login 200
 * dönüyordu; düşen çağrı `/MikroV17/sqlverioku` + gövdede `{ Query }` idi.
 * API'nin swagger'ı (7781 + 7782): `POST /api/MikroV17/SqlVeriOku` —
 * `query` ve `isProcedure` SORGU DİZGESİNDE, gövde `parameters`. Zorunlu
 * `query` dizgede olmayınca Web API eylem eşleştiremiyor → 404. Aynı 404
 * ARADEPO'nun çift-evrak denetimini de sessizce atlatıyordu.
 * Canlı doğrulama (salt okuma `SELECT 1`): yeni biçim + `{}` gövde →
 * `{"IsSuccess":true,"Result":[{"x":1}]}`; `[]` gövde → 500.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { MIKRO_API_URL: 'http://mikro.test:7781/api', MIKRO_USERNAME: 'u', MIKRO_PASSWORD: 'p' },
}));

const { sqlVeriOku, invalidateMikroCache } = await import('@/lib/mikro/client');

const cagrilar: Array<{ url: string; init: RequestInit }> = [];
let sorguCevabi: unknown = { IsSuccess: true, ErrorMessage: '', Result: [{ x: 1 }] };

beforeEach(() => {
  cagrilar.length = 0;
  sorguCevabi = { IsSuccess: true, ErrorMessage: '', Result: [{ x: 1 }] };
  invalidateMikroCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      cagrilar.push({ url, init });
      if (url.endsWith('/Login/Authenticate')) return new Response('"eyJ.test"', { status: 200 });
      return new Response(JSON.stringify(sorguCevabi), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('sqlVeriOku — API sözleşmesi', () => {
  it('query + isProcedure SORGU DİZGESİNDE, yöntem POST, gövde boş nesne', async () => {
    const r = await sqlVeriOku<{ x: number }>('SELECT 1 as x');
    expect(r.Result).toEqual([{ x: 1 }]);
    const sorgu = cagrilar.find((c) => !c.url.endsWith('/Login/Authenticate'))!;
    expect(sorgu.url).toBe('http://mikro.test:7781/api/MikroV17/SqlVeriOku?query=SELECT%201%20as%20x&isProcedure=false');
    expect(sorgu.init.method).toBe('POST');
    expect(sorgu.init.body).toBe('{}');
  });

  it('firma tabanı (7782) verilirse ona gider', async () => {
    await sqlVeriOku('SELECT 1', 'http://mikro.test:7782/api');
    const sorgu = cagrilar.find((c) => !c.url.endsWith('/Login/Authenticate'))!;
    expect(sorgu.url.startsWith('http://mikro.test:7782/api/MikroV17/SqlVeriOku?query=')).toBe(true);
  });

  it('tırnak ve yüzde işareti dizgede kodlanır (SQL bozulmaz)', async () => {
    await sqlVeriOku("SELECT TOP 1 cari_kod FROM CARI_HESAPLAR WHERE cari_CepTel LIKE '%5551112233'");
    const sorgu = cagrilar.find((c) => !c.url.endsWith('/Login/Authenticate'))!;
    const q = new URL(sorgu.url).searchParams.get('query');
    expect(q).toBe("SELECT TOP 1 cari_kod FROM CARI_HESAPLAR WHERE cari_CepTel LIKE '%5551112233'");
  });

  it('NEGATİF: IsSuccess:false sessizce "0 satır" sayılmaz — hata fırlatır', async () => {
    sorguCevabi = { IsSuccess: false, ErrorMessage: 'Geçersiz nesne adı', Result: '' };
    await expect(sqlVeriOku('SELECT * FROM YOK')).rejects.toThrow(/Mikro sorgu hatası/);
  });
});

describe('kaynak kilidi — eski 404 biçimi geri gelmez', () => {
  const oku = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('NEGATİF: mikro-sync.ts eski `/MikroV17/sqlverioku` + gövdede Query biçimini kullanmıyor', () => {
    const k = oku('src/lib/server/mikro-sync.ts');
    expect(k).not.toMatch(/['"`]\/MikroV17\/sqlverioku['"`]/);
    expect(k).not.toMatch(/body:\s*\{\s*Query:/);
    expect((k.match(/sqlVeriOku</g) ?? []).length).toBe(3);
  });

  it('stok betiği de aynı sözleşmeyle çağırıyor', () => {
    const k = oku('scripts/mikro-stock-sync.mts');
    expect(k).toMatch(/\/MikroV17\/SqlVeriOku\?query=\$\{encodeURIComponent\(sql\)\}&isProcedure=false/);
    expect(k).not.toMatch(/JSON\.stringify\(\{\s*Query:/);
  });
});
