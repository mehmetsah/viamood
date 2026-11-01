/**
 * #995397 · /admin/eposta-akislari · ÇİVİ — sayfa bileşeni gerçekten HTML'e basılır (sifremi-unuttum deseni),
 * veritabanı sahte bir sorgu zinciriyle beslenir; sorguya giden koşul PgDialect ile SQL'e çevrilip okunur.
 * Ölçülenler: kimlik kapısı (negatif) · filtrelerin sorguya geçişi · sayfalama sınırı · BOŞ veride sahte satır/sayı
 * yok (md.52) · null zaman «—» (0/1970 değil) · tablo yoksa çökmez · yazma çağrısı 0 (statik).
 * MUTASYON: kimlik satırı sökülünce · boş-veri kapısı sökülünce · bir filtre parametresi yok sayılınca KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PgDialect } from 'drizzle-orm/pg-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Sorgu = { tablo: string; sayim: boolean; where: unknown; limit?: number; offset?: number };
const durum = {
  rol: 'admin' as string | undefined,
  gTotal: 0, tTotal: 0,
  gSatir: [] as Array<Record<string, unknown>>,
  tSatir: [] as Array<Record<string, unknown>>,
  hata: false,
  sorgular: [] as Sorgu[],
};

vi.mock('@/lib/auth', () => ({ auth: async () => (durum.rol ? { user: { role: durum.rol } } : null) }));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/db/client', async () => {
  const { getTableName } = await import('drizzle-orm');
  const sec = (alanlar: Record<string, unknown>) => {
    const q: Sorgu = { tablo: '', sayim: 'total' in alanlar, where: undefined };
    const b: Record<string, unknown> = {
      from: (t: Parameters<typeof getTableName>[0]) => { q.tablo = getTableName(t); return b; },
      innerJoin: () => b, leftJoin: () => b, orderBy: () => b,
      where: (w: unknown) => { q.where = w; return b; },
      limit: (n: number) => { q.limit = n; return b; },
      offset: (n: number) => { q.offset = n; return b; },
      then: (ok: (v: unknown) => void, red: (e: unknown) => void) => {
        durum.sorgular.push(q);
        if (durum.hata) return red(new Error('relation does not exist'));
        const g = q.tablo === 'eposta_akis_gonderimleri';
        return ok(q.sayim ? [{ total: g ? durum.gTotal : durum.tTotal }] : g ? durum.gSatir : durum.tSatir);
      },
    };
    return b;
  };
  return { db: { select: sec } };
});

const { default: Sayfa } = await import('@/app/admin/eposta-akislari/page');
const { filtreCoz, tetikKosulu, gonderimKosulu, zamanGoster, PAGE_SIZE, DURUMLAR, AKISLAR } = await import('@/lib/eposta-akis-ekran');
const { adminYoluAcikMi, SSS_EDITOR } = await import('@/lib/yetki');

const ciz = async (sp: Record<string, string> = {}) =>
  renderToStaticMarkup(await Sayfa({ searchParams: Promise.resolve(sp) }));
const duz = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const sq = (w: unknown) => (w ? new PgDialect().sqlToQuery(w as Parameters<PgDialect['sqlToQuery']>[0]) : { sql: '', params: [] });
const sorgu = (tablo: string, sayim: boolean) => durum.sorgular.find((q) => q.tablo === tablo && q.sayim === sayim)!;
const G = 'eposta_akis_gonderimleri', T = 'eposta_akis_tetikleri';
const KOK = path.join(__dirname, '..');

const gSatir = (o: Record<string, unknown> = {}) => ({
  id: 'g1', akis: 'sepet_terki', email: 'ali@ornek.test', adim: 2, planlananAn: new Date('2026-10-30T10:00:00Z'),
  gonderimAni: new Date('2026-10-30T10:05:00Z'), durum: 'gonderildi', kanal: 'eposta', hataMetni: null,
  kupon: 'ST-ABC123', kuponKullanildi: null, ...o,
});
const tSatir = (o: Record<string, unknown> = {}) => ({
  id: 't1', akis: 'sepet_terki', email: 'ali@ornek.test', tetikAni: new Date('2026-10-29T10:00:00Z'), iysOnayi: false,
  iptalSebebi: null, iptalAni: null, ...o,
});

beforeEach(() => {
  Object.assign(durum, { rol: 'admin', gTotal: 0, tTotal: 0, gSatir: [], tSatir: [], hata: false, sorgular: [] });
});

describe('kimlik kapısı', () => {
  it.each([[undefined], ['customer'], ['vendor'], ['vendor_admin'], [SSS_EDITOR]])('rol %s → yönlendirilir, tek sorgu koşmaz', async (rol) => {
    durum.rol = rol;
    await expect(ciz()).rejects.toThrow('REDIRECT:/admin/urun-sss');
    expect(durum.sorgular).toEqual([]);
  });
  it('admin ve super_admin görür', async () => {
    for (const rol of ['admin', 'super_admin']) { durum.rol = rol; expect(duz(await ciz())).toContain('E-posta Akışları'); }
  });
  it('middleware yol kapısı: tam admin olmayan (SSS yetkili müşteri dahil) yola giremez — yeni muafiyet yok', () => {
    expect(adminYoluAcikMi('customer', '/admin/eposta-akislari', [SSS_EDITOR])).toBe(false);
    expect(adminYoluAcikMi('vendor', '/admin/eposta-akislari', [])).toBe(false);
    expect(adminYoluAcikMi('admin', '/admin/eposta-akislari', [])).toBe(true);
  });
});

describe('filtreler sorguya geçer', () => {
  it('akış · durum · e-posta (ilike) · tarih aralığı gönderim sorgusuna; durum HARİÇ hepsi tetik sorgusuna', async () => {
    await ciz({ akis: 'sepet_terki', durum: 'gonderildi', email: ' ali ', bas: '2026-10-01', son: '2026-10-31' });
    const g = sq(sorgu(G, false).where), gc = sq(sorgu(G, true).where), t = sq(sorgu(T, false).where);
    expect(g.params).toEqual(expect.arrayContaining(['sepet_terki', 'gonderildi', '%ali%']));
    expect(g.sql).toMatch(/ilike/);
    expect(g.params.map(String).join(' ')).toMatch(/2026-10-01/);
    expect(g.params.map(String).join(' ')).toMatch(/2026-10-31/);
    expect(gc).toEqual(g); // sayım ile satırlar AYNI koşulla
    expect(t.params).toEqual(expect.arrayContaining(['sepet_terki', '%ali%']));
    expect(t.params).not.toContain('gonderildi');
  });
  it('geçersiz akış/durum/tarih yok sayılır (sayfa çökmez, koşul eklenmez)', () => {
    const f = filtreCoz({ akis: 'xxx', durum: 'silindi', email: '   ', bas: '2026-13-45', son: 'dun' });
    expect(f).toEqual({ akis: undefined, durum: undefined, email: undefined, bas: null, son: null });
    expect(tetikKosulu(f)).toBeUndefined();
    expect(gonderimKosulu(f)).toBeUndefined();
  });
  it('seçenekler tek kaynaktan: akışlar AKIS, durumlar koşucunun DURUM sabiti (işleniyor dahil)', async () => {
    expect(AKISLAR).toEqual(['hos_geldin', 'sepet_terki', 'checkout_terki']);
    expect(DURUMLAR).toEqual(['planlandi', 'isleniyor', 'gonderildi', 'atlandi', 'iptal', 'hata']);
    const h = await ciz();
    for (const d of DURUMLAR) expect(h).toContain(`value="${d}"`);
  });
});

describe('sayfalama', () => {
  it('page ve tpage bağımsız: limit 30, offset (sayfa-1)×30; geçersiz sayfa 1', async () => {
    await ciz({ page: '3', tpage: '2' });
    expect(sorgu(G, false)).toMatchObject({ limit: PAGE_SIZE, offset: 60 });
    expect(sorgu(T, false)).toMatchObject({ limit: PAGE_SIZE, offset: 30 });
    durum.sorgular = [];
    await ciz({ page: '-4', tpage: 'abc' });
    expect(sorgu(G, false).offset).toBe(0);
    expect(sorgu(T, false).offset).toBe(0);
  });
  it('sayfa bağlantıları filtreyi korur; tetik sayfalaması gönderim sayfasını ezmez', async () => {
    durum.gTotal = 95; durum.tTotal = 61; durum.gSatir = [gSatir()]; durum.tSatir = [tSatir()];
    const h = await ciz({ akis: 'sepet_terki', page: '2' });
    expect(h).toContain('href="?akis=sepet_terki&amp;page=3"');
    expect(h).toContain('href="?akis=sepet_terki&amp;page=2&amp;tpage=2"');
  });
});

describe('BOŞ VERİ BOŞ KALIR (md.52)', () => {
  it('kayıt yoksa: boş durum metni var; sayı («0 kayıt»), örnek satır, kupon/e-posta yok', async () => {
    const m = duz(await ciz());
    expect(m).toContain('Bu filtreyle gönderim kaydı yok.');
    expect(m).toContain('Bu filtreyle akış başlangıcı yok.');
    expect(m).not.toMatch(/\d+ kayıt/);
    expect(m).not.toMatch(/@|ST-|HG-|CT-|1970/);
  });
  it('kayıt varsa gerçek sayı ve satır basılır', async () => {
    durum.gTotal = 1; durum.tTotal = 1; durum.gSatir = [gSatir()]; durum.tSatir = [tSatir()];
    const m = duz(await ciz());
    expect(m).toContain('1 kayıt');
    expect(m).toContain('ali@ornek.test');
    expect(m).toContain('ST-ABC123');
    expect(m).toContain('gönderildi · eposta');
    expect(m).not.toContain('Bu filtreyle gönderim kaydı yok.');
  });
  it('null zaman ve null kupon «—»; 1970/Invalid görünmez; hata metni ve erken kapanış sebebi görünür', async () => {
    durum.gTotal = 1; durum.tTotal = 1;
    durum.gSatir = [gSatir({ gonderimAni: null, durum: 'hata', kupon: null, hataMetni: 'smtp 550' })];
    durum.tSatir = [tSatir({ iptalSebebi: 'donusum', iptalAni: new Date('2026-10-29T12:00:00Z') })];
    const h = await ciz(), m = duz(h);
    expect(m).toContain('smtp 550');
    expect(m).toContain('dönüşüm (sipariş verdi)');
    expect(m).not.toMatch(/1970|Invalid/);
    expect((h.match(/>—</g) ?? []).length).toBeGreaterThanOrEqual(2); // gönderilmedi + kupon yok
    expect(zamanGoster(null)).toBe('—');
    expect(zamanGoster(undefined)).toBe('—');
  });
  it('tablolar okunamazsa sayfa çökmez, sebebini söyler, satır/sayı basmaz', async () => {
    durum.hata = true;
    const m = duz(await ciz());
    expect(m).toContain('Akış tabloları okunamadı');
    expect(m).not.toMatch(/\d+ kayıt|Bu filtreyle/);
  });
});

describe('YALNIZ OKUMA — statik ölçüm', () => {
  const kaynak = ['src/app/admin/eposta-akislari/page.tsx', 'src/lib/eposta-akis-ekran.ts'].map((f) => readFileSync(path.join(KOK, f), 'utf8'));
  it('sayfa ve lib: insert/update/delete/execute/ham sql çağrısı 0; server action yok', () => {
    for (const s of kaynak) {
      expect(s).not.toMatch(/\.(insert|update|delete|execute)\(|\bsql`|'use server'|"use server"/);
    }
  });
  it('akış koşucusu/gönderim/tetik davranışı çağrılmıyor (yalnız DURUM sabiti okunuyor)', () => {
    const lib = kaynak[1]!;
    expect(lib).toMatch(/import \{ DURUM \} from '\.\/eposta-akis-kosucu';/);
    expect(kaynak.join('\n')).not.toMatch(/eposta-akis-gonderim|eposta-akis-tetik|kosuCalistir|gonder\(/);
  });
  it('sayfa ikinci kimlik kapısını davet sayfasıyla AYNI satırla kurar; menüde emojisiz bağlantı', () => {
    expect(kaynak[0]).toContain("if (!tamAdminMi(session?.user?.role)) redirect('/admin/urun-sss');");
    const l = readFileSync(path.join(KOK, 'src/app/admin/layout.tsx'), 'utf8');
    expect(l).toContain('<Link href="/admin/eposta-akislari" className="px-3 py-2 rounded-lg hover:bg-white/10">E-posta Akışları</Link>');
  });
});
