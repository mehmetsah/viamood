/**
 * DAVET LİNKİ — SERVİS + UÇ çivileri (#992317).
 *
 * `tests/davet-linki.test.ts` saf kuralı (süre/özet/tek kullanım) çiviliyor.
 * Bu dosya ONUN ÜSTÜNDEKİ iki katmanı ölçer: DB'ye NE yazıldığını ve UÇTAN NE
 * döndüğünü. Ayrı durmalarının sebebi ölçülmüş bir arıza sınıfıdır: saf kural
 * doğru olsa bile uç katmanı sebebi ayırt eden bir hata cümlesi döndürürse
 * aşağıda kapatılan sızıntı yukarıdan geri açılır.
 *
 * NEGATİF ÇİVİLER (mutlu yol tek başına yetmez):
 *   · `admin` / `super_admin` davet linkiyle VERİLEMEZ — iki kapıdan da geçmez.
 *   · istemciden gelen `role` alanı OKUNMAZ (rol yükseltme denemesi işlemez).
 *   · "yok" · "süresi geçmiş" · "kullanılmış" → UÇTA TEK VE AYNI cümle.
 *   · ikinci eşzamanlı tüketim düşer (yarış koruması).
 *   · rol yazımı düşerse `usedAt` damgası GERİ ALINIR (link ölü kalmaz).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { APP_URL: 'https://ornek.test/' } }));
vi.mock('@/lib/password', () => ({
  hashPassword: async (p: string) => `hash(${p})`,
  validatePassword: (p: string) => (p.length >= 8 ? { ok: true } : { ok: false, reason: 'Şifre çok kısa' }),
}));
vi.mock('@/db/schema', () => ({
  inviteTokens: { tokenHash: 'token_hash', userId: 'user_id', usedAt: 'used_at' },
  sessions: { userId: 'user_id' },
  users: { id: 'id' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  isNull: (...a: unknown[]) => a,
  sql: Object.assign(() => 'sql', { raw: () => 'sql' }),
}));

// ── sahte DB: her çağrı ve her YAZILAN DEĞER kaydedilir ─────────────────────
type Satir = { userId: string | null; email: string; role: string; expiresAt: Date; usedAt: Date | null };

const durum: {
  secilen: Satir[];
  yazilanInsert: Record<string, unknown>[];
  yazilanUpdate: Record<string, unknown>[];
  returningSonuc: Record<string, unknown>[];
  cagrilar: string[];
  updateHatasi: boolean;
} = { secilen: [], yazilanInsert: [], yazilanUpdate: [], returningSonuc: [], cagrilar: [], updateHatasi: false };

function zincir(sonuc: unknown, etiket: string) {
  const nesne: Record<string, unknown> = {
    from: () => nesne,
    where: () => nesne,
    limit: () => Promise.resolve(sonuc),
    returning: () => Promise.resolve(durum.returningSonuc),
    then: (ok: (v: unknown) => unknown) => Promise.resolve(sonuc).then(ok),
  };
  durum.cagrilar.push(etiket);
  return nesne;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => zincir(durum.secilen, 'select'),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        durum.yazilanInsert.push(v);
        durum.cagrilar.push('insert');
        return Promise.resolve();
      },
    }),
    update: (tablo: unknown) => ({
      set: (v: Record<string, unknown>) => {
        const kullaniciMi = (tablo as Record<string, unknown>)?.id === 'id';
        if (kullaniciMi && durum.updateHatasi) {
          durum.cagrilar.push('update:users:HATA');
          return { where: () => Promise.reject(new Error('enum degeri yok')) };
        }
        durum.yazilanUpdate.push({ ...v, _tablo: kullaniciMi ? 'users' : 'invite_tokens' });
        durum.cagrilar.push(kullaniciMi ? 'update:users' : 'update:invite');
        return zincir(undefined, 'update-where');
      },
    }),
    delete: () => {
      durum.cagrilar.push('delete:sessions');
      return zincir(undefined, 'delete-where');
    },
  },
}));

import { tokenOzeti } from '@/lib/davet';
import { davetKontrolAction, davetParolaBelirleAction } from '@/lib/actions/davet';
import { DAVET_EDILEBILIR_ROLLER, davetKaydiOlustur, davetKontrol, davetTuket } from '@/lib/davet-servis';

const HAM = 'test-token-degeri-yalniz-testte';
const gecerliSatir = (over: Partial<Satir> = {}): Satir => ({
  userId: 'kullanici-1',
  email: 'davetli@ornek.test',
  role: 'vendor',
  expiresAt: new Date(Date.now() + 3600_000),
  usedAt: null,
  ...over,
});

function form(alanlar: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(alanlar)) f.append(k, v);
  return f;
}

beforeEach(() => {
  durum.secilen = [];
  durum.yazilanInsert = [];
  durum.yazilanUpdate = [];
  durum.returningSonuc = [];
  durum.cagrilar = [];
  durum.updateHatasi = false;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('davet kaydı — ham token DB’ye YAZILMAZ', () => {
  it('insert yalnız SHA-256 özeti taşır, ham token hiçbir alanda geçmez', async () => {
    const res = await davetKaydiOlustur({ email: 'Yeni@Ornek.TEST', role: 'vendor' });
    expect(res.ok).toBe(true);
    const yazilan = durum.yazilanInsert[0]!;
    const ham = new URL((res as { link: string }).link).searchParams.get('token')!;

    expect(yazilan.tokenHash).toBe(tokenOzeti(ham));
    expect(yazilan.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(yazilan)).not.toContain(ham);
    expect(yazilan.email).toBe('yeni@ornek.test'); // küçültülüp kırpılıyor
  });

  it('süre 24 saat ± 5 sn', async () => {
    const res = await davetKaydiOlustur({ email: 'a@b.test', role: 'customer' });
    const fark = (durum.yazilanInsert[0]!.expiresAt as Date).getTime() - Date.now();
    expect(Math.abs(fark - 24 * 3600_000)).toBeLessThan(5000);
    expect(res.ok).toBe(true);
  });

  it('NEGATİF: link log’a düşmez (log’lanan link paylaşılmış paroladır)', async () => {
    const res = await davetKaydiOlustur({ email: 'a@b.test', role: 'customer' });
    const ham = new URL((res as { link: string }).link).searchParams.get('token')!;
    const loglar = (console.info as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(' ');
    expect(loglar).not.toContain(ham);
  });
});

describe('NEGATİF: admin rolü davet linkiyle verilemez', () => {
  it.each(['admin', 'super_admin', 'root', ''])('%s reddedilir ve DB’ye satır YAZILMAZ', async (rol) => {
    const res = await davetKaydiOlustur({ email: 'a@b.test', role: rol });
    expect(res).toEqual({ ok: false, sebep: 'rol_izinli_degil' });
    expect(durum.yazilanInsert).toHaveLength(0);
  });

  it('beyaz liste admin/super_admin İÇERMEZ', () => {
    expect(DAVET_EDILEBILIR_ROLLER).not.toContain('admin');
    expect(DAVET_EDILEBILIR_ROLLER).not.toContain('super_admin');
  });

  it('İKİNCİ KAPI: satır kirlense bile admin rollü davet TÜKETİLEMEZ', async () => {
    durum.secilen = [gecerliSatir({ role: 'admin' })];
    durum.returningSonuc = [{ userId: 'kullanici-1', email: 'a@b.test', role: 'admin' }];
    const res = await davetTuket({ token: HAM, newPassword: 'uzun-parola-1' });
    expect(res).toEqual({ ok: false });
    expect(durum.cagrilar).not.toContain('update:users'); // parola/rol YAZILMADI
  });
});

describe('NEGATİF: üç geçersizlik hâli UÇTA ayırt edilemez', () => {
  const haller: Array<[string, Satir[]]> = [
    ['kayıt yok', []],
    ['süresi geçmiş', [gecerliSatir({ expiresAt: new Date(Date.now() - 1000) })]],
    ['kullanılmış', [gecerliSatir({ usedAt: new Date() })]],
  ];

  it('davetKontrolAction üçünde de AYNI cümleyi döner', async () => {
    const cevaplar: string[] = [];
    for (const [, satirlar] of haller) {
      durum.secilen = satirlar;
      const r = await davetKontrolAction(HAM);
      expect(r.success).toBe(false);
      cevaplar.push((r as { error: string }).error);
    }
    expect(new Set(cevaplar).size).toBe(1);
    expect(cevaplar[0]).toContain('24 saat');
  });

  it('davetParolaBelirleAction üçünde + boş token’da AYNI cümleyi döner', async () => {
    const cevaplar: string[] = [];
    for (const [, satirlar] of haller) {
      durum.secilen = satirlar;
      const r = await davetParolaBelirleAction(form({ token: HAM, password: 'uzun-parola-1', passwordConfirm: 'uzun-parola-1' }));
      cevaplar.push((r as { error: string }).error);
    }
    const bos = await davetParolaBelirleAction(form({ token: '', password: 'uzun-parola-1', passwordConfirm: 'uzun-parola-1' }));
    cevaplar.push((bos as { error: string }).error);
    expect(new Set(cevaplar).size).toBe(1);
  });

  it('geçersizken DB’ye HİÇBİR yazma yapılmaz', async () => {
    durum.secilen = [gecerliSatir({ usedAt: new Date() })];
    await davetParolaBelirleAction(form({ token: HAM, password: 'uzun-parola-1', passwordConfirm: 'uzun-parola-1' }));
    expect(durum.yazilanUpdate).toHaveLength(0);
    expect(durum.yazilanInsert).toHaveLength(0);
  });
});

describe('tüketim — mutlu yol ve yarış', () => {
  it('parola + rol yazılır, damga vurulur, oturumlar düşer', async () => {
    durum.secilen = [gecerliSatir()];
    durum.returningSonuc = [{ userId: 'kullanici-1', email: 'davetli@ornek.test', role: 'vendor' }];
    const res = await davetParolaBelirleAction(
      form({ token: HAM, password: 'uzun-parola-1', passwordConfirm: 'uzun-parola-1' }),
    );
    expect(res).toEqual({ success: true, data: { email: 'davetli@ornek.test' } });

    const damga = durum.yazilanUpdate.find((u) => u._tablo === 'invite_tokens' && u.usedAt instanceof Date);
    expect(damga).toBeTruthy();
    const kullanici = durum.yazilanUpdate.find((u) => u._tablo === 'users')!;
    expect(kullanici.role).toBe('vendor');
    expect(kullanici.passwordHash).toBe('hash(uzun-parola-1)');
    expect(durum.cagrilar).toContain('delete:sessions');
  });

  it('NEGATİF: yarışı kaybeden ikinci istek düşer (returning boş)', async () => {
    durum.secilen = [gecerliSatir()];
    durum.returningSonuc = []; // koşullu update hiçbir satır alamadı
    const res = await davetTuket({ token: HAM, newPassword: 'uzun-parola-1' });
    expect(res).toEqual({ ok: false });
    expect(durum.cagrilar).not.toContain('update:users');
  });

  it('NEGATİF: rol yazımı düşerse usedAt damgası GERİ ALINIR (link ölü kalmaz)', async () => {
    durum.secilen = [gecerliSatir({ role: 'sss_editor' })];
    durum.returningSonuc = [{ userId: 'kullanici-1', email: 'a@b.test', role: 'sss_editor' }];
    durum.updateHatasi = true;
    const res = await davetTuket({ token: HAM, newPassword: 'uzun-parola-1' });
    expect(res).toEqual({ ok: false });
    const geriAlma = durum.yazilanUpdate.find((u) => u._tablo === 'invite_tokens' && u.usedAt === null);
    expect(geriAlma).toBeTruthy();
  });

  it('NEGATİF: istemcinin gönderdiği role/email alanları OKUNMAZ', async () => {
    durum.secilen = [gecerliSatir({ role: 'customer' })];
    durum.returningSonuc = [{ userId: 'kullanici-1', email: 'davetli@ornek.test', role: 'customer' }];
    await davetParolaBelirleAction(
      form({
        token: HAM,
        password: 'uzun-parola-1',
        passwordConfirm: 'uzun-parola-1',
        role: 'super_admin',
        email: 'saldirgan@ornek.test',
      }),
    );
    const kullanici = durum.yazilanUpdate.find((u) => u._tablo === 'users')!;
    expect(kullanici.role).toBe('customer'); // DB satırındaki rol, istemcinin dediği DEĞİL
  });

  it('zayıf parola tüketimden ÖNCE düşer — token harcanmaz', async () => {
    durum.secilen = [gecerliSatir()];
    const res = await davetParolaBelirleAction(form({ token: HAM, password: 'kisa', passwordConfirm: 'kisa' }));
    expect(res.success).toBe(false);
    expect(durum.cagrilar).toHaveLength(0); // DB’ye hiç gidilmedi
  });

  it('kontrol TÜKETMEZ ve rolü istemciye SÖYLEMEZ', async () => {
    durum.secilen = [gecerliSatir()];
    const r = await davetKontrolAction(HAM);
    expect(r).toEqual({ success: true, data: { email: 'davetli@ornek.test' } });
    expect(JSON.stringify(r)).not.toContain('vendor');
    expect(durum.yazilanUpdate).toHaveLength(0);
  });

  it('servis katmanı geçerli kaydın rolünü döner (uç onu dışarı vermez)', async () => {
    durum.secilen = [gecerliSatir()];
    await expect(davetKontrol(HAM)).resolves.toEqual({
      gecerli: true,
      email: 'davetli@ornek.test',
      role: 'vendor',
      userId: 'kullanici-1',
    });
  });
});
