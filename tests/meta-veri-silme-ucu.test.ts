/**
 * #990686 madde 4 — Meta veri silme ucu DAVRANIŞ çivisi.
 *
 * ⚠ NEDEN İKİNCİ TEST DOSYASI: `tests/veri-silme-manuel-onay.test.ts` bu ucu
 * yalnız KAYNAK METNİ olarak denetliyor (bölge kilidi) — `db.delete` geri
 * eklenirse kırılır, ki o doğru ve değerli. Ama "geçersiz imza 400 döner"
 * iddiası orada dosyada herhangi bir `status: 400` görünce yeşil yanıyor:
 * imza denetimi tamamen silinse bile `signed_request` eksikliği dalındaki 400
 * testi geçirir. Bu dosya ucu GERÇEKTEN ÇAĞIRIR ve üç ayağı ölçer.
 *
 * GERÇEK SIR KULLANILMADI — uydurma test gizi ('test-gizi-990686') ile imza
 * üretilir; kasadan/env'den değer okunmaz, hiçbir yere yazılmaz.
 * GERÇEK VERİ SİLİNMEZ — DB tamamen taklit (mock), silme çağrısı zaten yok.
 */
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const GIZ = 'test-gizi-990686';

// ── sahte DB: YAZILAN her değer kaydedilir (desen: tests/davet-ucu.test.ts) ──
const durum: {
  insertler: Record<string, unknown>[];
  updateler: Record<string, unknown>[];
  accountsSonuc: { userId: string }[];
} = { insertler: [], updateler: [], accountsSonuc: [] };

vi.mock('@/lib/auth/social', () => ({
  getFacebookCreds: async () => ({ clientId: 'x', clientSecret: GIZ }),
}));
vi.mock('@/db/schema', () => ({
  accounts: { provider: 'provider', providerAccountId: 'provider_account_id', userId: 'user_id' },
}));
vi.mock('@/db/schema/veri-silme', () => ({
  veriSilmeTalepleri: { kod: 'kod', providerUserId: 'provider_user_id' },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/db/client', () => ({
  db: {
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        durum.insertler.push(v);
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: async () => {
          durum.updateler.push(v);
        },
      }),
    }),
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => durum.accountsSonuc }) }),
    }),
  },
}));

const { POST } = await import('@/app/api/auth/facebook/data-deletion/route');

/** Meta'nın gönderdiği biçim: "<imza base64url>.<payload base64url>" */
function signedRequest(payload: object, giz = GIZ): string {
  const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const imza = b64url(createHmac('sha256', giz).update(payloadB64).digest());
  return `${imza}.${payloadB64}`;
}

function istek(sr: string | null) {
  const form = new FormData();
  if (sr !== null) form.set('signed_request', sr);
  return new Request('https://hesap.viamood.com.tr/api/auth/facebook/data-deletion', {
    method: 'POST',
    body: form,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  durum.insertler = [];
  durum.updateler = [];
  durum.accountsSonuc = [];
});

describe('AYAK 1 — geçerli imza → 200 + confirmation_code', () => {
  it('bizdeki kullanıcı bulunursa 200, kod üretilir, durum onay-bekliyor', async () => {
    durum.accountsSonuc = [{ userId: 'bizdeki-kullanici-1' }];
    const res = await POST(istek(signedRequest({ user_id: '1234567890123456' })));
    expect(res.status).toBe(200);

    const govde = (await res.json()) as { url: string; confirmation_code: string };
    expect(govde.confirmation_code, 'Meta sözleşmesi: confirmation_code zorunlu').toMatch(/^[0-9a-f]{12}$/);
    expect(govde.url).toContain('/veri-silme-durumu?kod=');
    expect(govde.url, 'durum URL kodu taşımalı — kullanıcı talebini sorgulayabilsin')
      .toContain(govde.confirmation_code);

    expect(durum.insertler).toHaveLength(1);
    expect(durum.insertler[0]!.providerUserId).toBe('1234567890123456');

    const son = durum.updateler.at(-1)!;
    expect(son.durum).toBe('onay-bekliyor');
    expect(son.userId).toBe('bizdeki-kullanici-1');
    expect(son.completedAt, 'silme yapılmadı ⇒ talep TAMAMLANMIŞ sayılamaz').toBeNull();
  });
});

describe('AYAK 2 — bozuk/eksik imza → 400 ve KAYIT OLUŞMAZ (negatif)', () => {
  it('YANLIŞ gizle imzalanmış istek 400, DB’ye hiçbir satır yazılmaz', async () => {
    const res = await POST(istek(signedRequest({ user_id: '999' }, 'saldirganin-gizi')));
    expect(res.status).toBe(400);
    expect(durum.insertler, 'imzasız istekte insert = flood kapısı').toHaveLength(0);
    expect(durum.updateler).toHaveLength(0);
  });

  it('imza bölümü KURCALANMIŞ istek 400, kayıt yok', async () => {
    const sr = signedRequest({ user_id: '1234567890123456' });
    const [, payload] = sr.split('.');
    const res = await POST(istek(`AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.${payload}`));
    expect(res.status).toBe(400);
    expect(durum.insertler).toHaveLength(0);
  });

  it('nokta içermeyen / biçimsiz signed_request 400, kayıt yok', async () => {
    const res = await POST(istek('bu-imza-degil'));
    expect(res.status).toBe(400);
    expect(durum.insertler).toHaveLength(0);
  });

  it('signed_request HİÇ YOKSA 400, kayıt yok', async () => {
    const res = await POST(istek(null));
    expect(res.status).toBe(400);
    expect(durum.insertler).toHaveLength(0);
  });

  it('payload base64 çözülemiyorsa 400 (JSON değil), kayıt yok', async () => {
    const res = await POST(istek('AAAA.!!!!not-base64-json!!!!'));
    expect(res.status).toBe(400);
    expect(durum.insertler).toHaveLength(0);
  });
});

describe('AYAK 3 — bilinmeyen user_id → kayıt SIZDIRMAYAN cevap', () => {
  it('eşleşme yoksa cevap AYNI biçimde döner; kullanıcı bilgisi sızmaz', async () => {
    durum.accountsSonuc = []; // bizde böyle bir bağlantı yok
    const res = await POST(istek(signedRequest({ user_id: '7777777777777777' })));
    expect(res.status).toBe(200);

    const ham = await res.text();
    const govde = JSON.parse(ham) as Record<string, unknown>;
    // Cevap YALNIZ iki alan taşır — "bu kullanıcı bizde yok/var" ayrımı dışarı çıkmaz.
    expect(Object.keys(govde).sort()).toEqual(['confirmation_code', 'url']);
    expect(ham).not.toContain('kayit-bulunamadi');
    expect(ham).not.toContain('bulunamadı');
    expect(ham).not.toContain('@');

    // İç kayıtta ayrım TUTULUR (operatör görsün) — ama dışarı dönmez.
    const son = durum.updateler.at(-1)!;
    expect(son.durum).toBe('kayit-bulunamadi');
    expect(son.userId).toBeNull();
  });

  it('bilinen ve bilinmeyen user_id cevabının ALAN KÜMESİ aynı (sayım farkı bile sızmasın)', async () => {
    durum.accountsSonuc = [{ userId: 'u1' }];
    const varOlan = Object.keys((await (await POST(istek(signedRequest({ user_id: '111' })))).json()) as object).sort();
    durum.insertler = [];
    durum.updateler = [];
    durum.accountsSonuc = [];
    const olmayan = Object.keys((await (await POST(istek(signedRequest({ user_id: '222' })))).json()) as object).sort();
    expect(olmayan).toEqual(varOlan);
  });
});
