/**
 * #994995 · İÇ NOT TEMİZLİĞİ ÇİVİSİ — gerçek ÖNCESİ/TASLAK dosyalarıyla (veri/994995-aciklama/).
 * MUTASYON: src/lib/aciklama-ic-not.ts içindeki ÖNCESİ md5 kapısı ya da "yeni bilgi" kapısı
 * kaldırılırsa ilgili iddialar KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bulunanKaliplar, metinParcalari, tabloSayisi, taslakCalistir, taslakKarar, type KutukSatiri } from '../src/lib/aciklama-ic-not';

const D = path.join(__dirname, '..', 'veri', '994995-aciklama');
const M = JSON.parse(readFileSync(path.join(D, 'manifest.json'), 'utf8')) as Array<{ handle: string; once: string; taslak: string; onceMd5: string }>;
const oku = (f: string) => readFileSync(path.join(D, f), 'utf8');

describe('gerçek taslaklar', () => {
  it('iki ürün de kapılardan geçer: iç not çıkar, tablo 2 → 1, yeni metin yok', () => {
    expect(M).toHaveLength(2);
    for (const m of M) {
      const k = taslakKarar(oku(m.once), m.onceMd5, oku(m.taslak));
      expect(k.durum).toBe('uygulanacak');
      if (k.durum === 'uygulanacak') { expect(k.tabloOnce).toBe(2); expect(k.tabloSonra).toBe(1); expect(k.cikanKaliplar.length).toBeGreaterThan(0); }
    }
  });

  it('Hello Kitty: dört kalıbın dördü de öncede VAR, taslakta YOK', () => {
    const hk = M.find((m) => m.handle.endsWith('hkt11000'))!;
    expect(bulunanKaliplar(oku(hk.once))).toHaveLength(4);
    expect(bulunanKaliplar(oku(hk.taslak))).toHaveLength(0);
    expect(tabloSayisi(oku(hk.taslak))).toBe(1);
  });
});

describe('kapılar', () => {
  const m = M[0]!;
  const once = oku(m.once), taslak = oku(m.taslak);

  it('canlı ÖNCESİ\'nden farklıysa YAZILMAZ (arada elle değişmiş)', () => {
    expect(taslakKarar(once + ' ', m.onceMd5, taslak)).toMatchObject({ durum: 'atlandi' });
  });
  it('taslak canlıda olmayan cümle eklerse YAZILMAZ (yeni bilgi yasak)', () => {
    const k = taslakKarar(once, m.onceMd5, taslak.replace('</h2>', '</h2><p>Bugün kargoda bedava!</p>'));
    expect(k.durum).toBe('atlandi');
    expect(k.durum === 'atlandi' && k.sebep).toContain('yeni bilgi');
  });
  it('taslakta iç not kalıbı kalırsa YAZILMAZ', () => {
    expect(taslakKarar(once, m.onceMd5, taslak + '<p>Diğer alanlar: x</p>')).toMatchObject({ durum: 'atlandi' });
  });
  it('taslakta iki tablo varsa YAZILMAZ', () => {
    expect(taslakKarar(once, m.onceMd5, taslak + '<table><tr><td>Yaş</td></tr></table>')).toMatchObject({ durum: 'atlandi' });
  });
  it('metin parçaları: varlıklar çözülür', () => {
    expect(metinParcalari('<p>Mix &amp; Match</p>')).toEqual(['Mix & Match']);
  });
});

describe('taslakCalistir', () => {
  const isler = M.map((m) => ({ handle: m.handle, onceMd5: m.onceMd5, taslakHtml: oku(m.taslak) }));
  const sahte = () => {
    const db: Record<string, string> = Object.fromEntries(M.map((m) => [m.handle, oku(m.once)]));
    const yazilan: string[] = []; const kutuk: KutukSatiri[] = [];
    return { db, yazilan, kutuk, dep: {
      oku: async (h: string) => (h in db ? { id: h, html: db[h]! } : null),
      yaz: async (id: string, html: string) => { yazilan.push(id); db[id] = html; return { ok: true as const }; },
      kutuk: (s: KutukSatiri) => { kutuk.push(s); },
    } };
  };

  it('DRY-RUN: yaz HİÇ çağrılmaz', async () => {
    const s = sahte();
    const oz = await taslakCalistir(isler, s.dep, { uygula: false });
    expect(oz).toMatchObject({ taranan: 2, uygulanacak: 2, uygulandi: 0 });
    expect(s.yazilan).toHaveLength(0);
  });
  it('UYGULA: iki ürün yazılır, kütük geri alma için öncesini taşır; İKİNCİ koşu 0 yazar', async () => {
    const s = sahte();
    const oz = await taslakCalistir(isler, s.dep, { uygula: true });
    expect(oz.uygulandi).toBe(2);
    expect(s.kutuk.every((k) => k.durum === 'uygulandi' && (k.onceHtml ?? '').length > 1000)).toBe(true);
    const oz2 = await taslakCalistir(isler, s.dep, { uygula: true });
    expect(oz2).toMatchObject({ uygulandi: 0, atlandi: 2 });
    expect(s.yazilan).toHaveLength(2);
  });
  it('ürün yoksa hata sayılır, süreç durmaz', async () => {
    const s = sahte();
    const oz = await taslakCalistir([{ handle: 'yok', onceMd5: 'x', taslakHtml: '' }, ...isler], s.dep, { uygula: false });
    expect(oz).toMatchObject({ hata: 1, uygulanacak: 2 });
  });
});
