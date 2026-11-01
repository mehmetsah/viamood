/**
 * #995707 · KALIP KİLİDİ ÇİVİSİ — `/admin/eposta-akislari` ↔ `/admin/mail-gecmisi` (md.16: var olan yüzey yeniden çizilmez).
 * Sayfa bileşenleri gerçekten HTML'e basılır (db sahte sorgu zinciriyle beslenir) ve imzalar çıkarılır; ŞAH'ın tarayıcı ölçümüyle
 * (tests/kalip-kilidi-imza.ts) BİREBİR karşılaştırılır: DOLU · BOŞ · TABLO YOK hâlleri, iki sayfa.
 * Kural katmanı: keyfi değer (`-[…]`) yok · fikstürde olmayan RENK sınıfı yok.
 * NEGATİF KONTROL: mutant HTML'e yeni renk + keyfi değer eklenince kırılır; 10 meşru «şüpheli» örnekte yanlış alarm 0.
 * MUTASYON: sayfaya renk/keyfi değer/boşluk değişikliği girince, beyaz liste gerekçesi silinince, kapsam listesi bozulunca KIRILIR.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BEYAZ_LISTE, HAL_IMZALARI, KILITLI_SAYFALAR, MESRU_SINIF_ORNEKLERI, ORTAK_IMZALAR } from './kalip-kilidi-imza';

const veri = { hata: false, t: {} as Record<string, { total: number; rows: unknown[] }> };
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { role: 'admin' } }) }));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => <a href={href} className={className}>{children}</a>,
}));
vi.mock('@/db/client', async () => {
  const { getTableName } = await import('drizzle-orm');
  const sec = (alan: Record<string, unknown>) => {
    let t = '';
    const b: Record<string, unknown> = {
      from: (x: Parameters<typeof getTableName>[0]) => { t = getTableName(x); return b; },
      innerJoin: () => b, leftJoin: () => b, orderBy: () => b, where: () => b, limit: () => b, offset: () => b,
      then: (ok: (v: unknown) => void, red: (e: unknown) => void) => (veri.hata ? red(new Error('relation does not exist')) : ok('total' in alan ? [{ total: veri.t[t]!.total }] : veri.t[t]!.rows)),
    };
    return b;
  };
  return { db: { select: sec } };
});

const { default: MailSayfa } = await import('@/app/admin/mail-gecmisi/page');
const { default: AkisSayfa } = await import('@/app/admin/eposta-akislari/page');
const KOK = path.join(__dirname, '..');

/** İmza = etiket + sıralı sınıflar; kök `div.p-6` hariç (ŞAH ölçümüyle aynı kural). */
export function imzalar(html: string): string[] {
  const govde = html.replace(/^<div class="p-6">/, '');
  const s = new Set<string>();
  for (const m of govde.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)) {
    const c = /\sclass="([^"]*)"/.exec(m[2]!);
    s.add(m[1] + '.' + (c ? c[1]!.split(/\s+/).filter(Boolean).sort().join('.') : ''));
  }
  return [...s].sort();
}
const RENK = /^(?:[a-z-]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|decoration|accent|caret)-(?:[a-z]+-\d{2,3}|black|white)(?:\/\d+)?$/;
const tumImzalar = [...ORTAK_IMZALAR, ...Object.keys(BEYAZ_LISTE.mail), ...Object.keys(BEYAZ_LISTE.akis), ...Object.values(HAL_IMZALARI).flat()];
const IZINLI_RENK = new Set(tumImzalar.flatMap((i) => i.split('.').slice(1)).filter((c) => RENK.test(c)));
/** Kural katmanı: keyfi değer ve fikstürde olmayan renk. Dönen dizi = ihlaller. */
export function kuralIhlali(siniflar: string): string[] {
  return siniflar.split(/\s+/).filter(Boolean).flatMap((c) => [
    ...(/\[[^\]]*\]/.test(c) ? [`keyfi değer: ${c}`] : []),
    ...(RENK.test(c) && !IZINLI_RENK.has(c) ? [`kalıpta olmayan renk: ${c}`] : []),
  ]);
}
const sinifDizileri = (html: string) => [...html.matchAll(/\sclass="([^"]*)"/g)].map((m) => m[1]!);

const dt = new Date('2026-10-30T10:00:00Z');
const DOLU = {
  mail_log: { total: 45, rows: [['islemsel', true], ['pazarlama', false], ['duyuru', true]].map(([tip, b], i) => ({ id: `m${i}`, alici: 'a@t', konu: 'k', sablon: 's', tip, basarili: b, kanal: 'smtp', hata: b ? null : 'h', createdAt: dt })) },
  eposta_akis_gonderimleri: { total: 45, rows: [
    { id: 'g1', akis: 'sepet_terki', email: 'a@t', adim: 1, planlananAn: dt, gonderimAni: dt, durum: 'gonderildi', kanal: 'eposta', hataMetni: null, kupon: 'ST-X', kuponKullanildi: dt },
    { id: 'g2', akis: 'hos_geldin', email: 'b@t', adim: 2, planlananAn: dt, gonderimAni: null, durum: 'planlandi', kanal: 'eposta', hataMetni: null, kupon: null, kuponKullanildi: null },
    { id: 'g3', akis: 'sepet_terki', email: 'c@t', adim: 3, planlananAn: dt, gonderimAni: null, durum: 'hata', kanal: 'eposta', hataMetni: 'x', kupon: null, kuponKullanildi: null },
  ] },
  eposta_akis_tetikleri: { total: 45, rows: [{ id: 't1', akis: 'sepet_terki', email: 'a@t', tetikAni: dt, iysOnayi: false, iptalSebebi: 'donusum', iptalAni: dt }] },
};
const BOS = { mail_log: { total: 0, rows: [] }, eposta_akis_gonderimleri: { total: 0, rows: [] }, eposta_akis_tetikleri: { total: 0, rows: [] } };
async function bas(hal: 'dolu' | 'bos' | 'amber') {
  veri.hata = hal === 'amber'; veri.t = hal === 'bos' ? BOS : DOLU;
  const sp = hal === 'dolu' ? { page: '2', tpage: '2' } : {};
  return {
    mail: renderToStaticMarkup(await MailSayfa({ searchParams: Promise.resolve(sp) })),
    akis: renderToStaticMarkup(await AkisSayfa({ searchParams: Promise.resolve(sp) })),
  };
}

describe('fikstür', () => {
  it('29 ortak imza; beyaz liste sayfa başına 5 ve HER satır gerekçeli; ortak ile beyaz liste kesişmez', () => {
    expect(ORTAK_IMZALAR).toHaveLength(29);
    for (const s of ['mail', 'akis'] as const) {
      expect(Object.keys(BEYAZ_LISTE[s])).toHaveLength(5);
      for (const [imza, g] of Object.entries(BEYAZ_LISTE[s])) { expect(g.trim().length, imza).toBeGreaterThan(30); expect(ORTAK_IMZALAR).not.toContain(imza); }
    }
  });
});

describe('kilit — sayfa çıktısı ŞAH ölçümüyle BİREBİR', () => {
  it('DOLU: her sayfa = 29 ortak + kendi 5 gerekçeli farkı (fazlası da eksiği de kırılır)', async () => {
    const h = await bas('dolu');
    expect(imzalar(h.mail)).toEqual([...ORTAK_IMZALAR, ...Object.keys(BEYAZ_LISTE.mail)].sort());
    expect(imzalar(h.akis)).toEqual([...ORTAK_IMZALAR, ...Object.keys(BEYAZ_LISTE.akis)].sort());
  });
  it('BOŞ ve TABLO YOK hâlleri: ŞAH ölçümüyle birebir', async () => {
    const b = await bas('bos');
    expect(imzalar(b.mail)).toEqual(HAL_IMZALARI['mail-bos']);
    expect(imzalar(b.akis)).toEqual(HAL_IMZALARI['akis-bos']);
    const a = await bas('amber');
    expect(imzalar(a.mail)).toEqual(HAL_IMZALARI['mail-amber']);
    expect(imzalar(a.akis)).toEqual(HAL_IMZALARI['akis-amber']);
  });
  it('kural katmanı: üç hâlin hiçbirinde keyfi değer ya da kalıpta olmayan renk YOK', async () => {
    for (const hal of ['dolu', 'bos', 'amber'] as const) {
      const h = await bas(hal);
      expect([...sinifDizileri(h.mail), ...sinifDizileri(h.akis)].flatMap(kuralIhlali), hal).toEqual([]);
    }
  });
});

describe('NEGATİF KONTROL', () => {
  it('mutant çıktı: yeni renk + keyfi değer eklenince HEM kural HEM kilit kırılır', async () => {
    const h = await bas('dolu');
    const mutant = h.akis.replace('<h2 class="mt-6', '<span class="text-emerald-600 mt-[13px]">yeni</span><h2 class="mt-6');
    expect(sinifDizileri(mutant).flatMap(kuralIhlali).sort()).toEqual(['kalıpta olmayan renk: text-emerald-600', 'keyfi değer: mt-[13px]']);
    expect(imzalar(mutant)).not.toEqual([...ORTAK_IMZALAR, ...Object.keys(BEYAZ_LISTE.akis)].sort());
  });
  it('mutant çıktı: yalnız boşluk ölçeği değişince (py-2 → py-3) kilit kırılır (kural katmanı bunu yakalamaz, kilit yakalar)', async () => {
    const h = await bas('dolu');
    const mutant = h.akis.replaceAll('py-2 pr-3', 'py-3 pr-3');
    expect(sinifDizileri(mutant).flatMap(kuralIhlali)).toEqual([]);
    expect(imzalar(mutant)).not.toEqual([...ORTAK_IMZALAR, ...Object.keys(BEYAZ_LISTE.akis)].sort());
  });
  it.each(MESRU_SINIF_ORNEKLERI)('meşru «şüpheli» örnek yanlış alarm vermez: %s', (s) => expect(kuralIhlali(s)).toEqual([]));
});

describe('kapsam', () => {
  it('kaynağında «admin/mail-gecmisi sayfasının kalıbı» diyen her admin sayfası kilit listesinde', () => {
    const sayfalar: string[] = [];
    const gez = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) gez(p); else if (f === 'page.tsx') sayfalar.push(p); } };
    gez(path.join(KOK, 'src', 'app', 'admin'));
    const kalipli = sayfalar.filter((p) => /`admin\/mail-gecmisi` sayfasının kalıbı/.test(readFileSync(p, 'utf8'))).map((p) => path.relative(KOK, p));
    expect(kalipli.length).toBeGreaterThan(0);
    for (const p of kalipli) expect(KILITLI_SAYFALAR as readonly string[]).toContain(p);
  });
});
