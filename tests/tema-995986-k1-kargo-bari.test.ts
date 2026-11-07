/** #995986 · ayse:863 KALEM 1 — «24 saat içinde kargoda» barı basılmaz (vm_rozet_2 disabled). Canlıya istek yok; paket ölçülür. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995986-k1-kargo-bari');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const js = (s: string) => JSON.parse(s.slice(s.indexOf('{')));
type B = { type: string; disabled?: boolean; settings?: Record<string, unknown>; blocks?: Record<string, B>; block_order?: string[] };
const pd = (o: { sections: { main: { blocks: Record<string, B> } } }) => o.sections.main.blocks['product-details'] as B;
const py = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c', 'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

describe('#995986 K1 kargo barı', () => {
  const o = oku('ONCESI/templates__product.json'), s = oku('SONRASI/templates__product.json');
  const m = JSON.parse(oku('md5.json'))['templates/product.json'];
  it('md5 kütüğü tutuyor; ÖNCESİ = #995939 SONRASI (5ab2187b)', () => {
    expect(md5(o)).toBe(m.once); expect(md5(s)).toBe(m.sonra); expect(m.once).toBe('5ab2187bf9f2e6c9e56dc7e9509fee1f');
  });
  it('yalnız «24 saat içinde kargoda» rozeti devre dışı; öteki üç rozet ve sayaç AYNEN', () => {
    const roz = pd(js(s)).blocks!.vm_rozetler!.blocks!;
    expect(roz.vm_rozet_2!.disabled).toBe(true);
    expect(roz.vm_rozet_2!.blocks!.vm_rozet_metin_2!.settings!.text).toBe('<p>24 saat içinde kargoda</p>');
    for (const k of ['vm_rozet_1', 'vm_rozet_3', 'vm_rozet_4']) expect(roz[k]!.disabled).toBeUndefined();
    expect(pd(js(s)).block_order).toContain('via_kargo_sayaci');
    expect(pd(js(s)).blocks!.via_kargo_sayaci!.disabled).toBeUndefined();
    expect(pd(js(o)).blocks!.vm_rozetler!.blocks!.vm_rozet_2!.disabled).toBeUndefined();
  });
  it('dosyada tek satır eklendi', () => {
    const a = o.split('\n'), b = s.split('\n');
    expect(b.length - a.length).toBe(1);
    expect(b.filter((x) => !a.includes(x)).map((x) => x.trim())).toEqual(['"disabled": true,']);
  });
  it('yama.py bayt bayt üretir, ikinci uygulamayı ve ikinci JSON alanını reddeder', () => {
    expect(md5(py('sys.stdout.write(yama.uygula(yama.K, sys.stdin.read()))', o))).toBe(md5(s));
    expect(() => py('yama.uygula(yama.K, sys.stdin.read())', s)).toThrow(/zaten uygulanmış/);
    expect(() => py('yama.YENI = yama.YENI + \'                  "via_sahte": 1,\\n\'; yama.uygula(yama.K, sys.stdin.read())', o)).toThrow(/beklenmeyen JSON farkı/);
  });
});
