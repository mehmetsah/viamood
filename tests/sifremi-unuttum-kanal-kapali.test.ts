/**
 * Şifremi Unuttum — mail kanalı kapalıyken SESSİZ DÜŞMEME testleri (Defter #1448).
 *
 * ÖLÇÜLEN ARIZA (16 Eyl 2026, canlı prod, SSM ile):
 *   .env.production'da RESEND_API_KEY / SMTP_* tanımlı DEĞİL → sendEmail()
 *   {ok:false, kanal:'stub'} dönüyordu. Servis bunu {ok:true, mailGitti:false}
 *   diye paketliyor, istemci ise yalnız success===true'ya bakıp YEŞİL ONAY
 *   basıyordu. Müşteri "gönderdik, gelen kutunu kontrol et" görüyor, mail hiç
 *   gitmiyordu; üstelik her deneme 5 dakikalık oran sınırını tüketiyordu.
 *
 * Buradaki testler üç şeyi çiviliyor:
 *   1. Kanal kapalıyken DB'ye DOKUNULMUYOR (token yok, oran sınırı sorgusu yok).
 *   2. Yanıt `kanalKapali` ile işaretleniyor ve action dürüst metni döndürüyor.
 *   3. Yanıt E-POSTAYA BAKMADAN üretiliyor — kayıtlı/kayıtsız adres AYNI şeyi
 *      görür, yani hesap varlığı sızmaz (password-reset.ts değişmez 1).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── env: testler arasında değiştirilebilsin diye canlı nesne ────────────────
const testEnv: Record<string, string | undefined> = {};
vi.mock('@/lib/env', () => ({ env: testEnv }));

// ── DB: her çağrı SAYILIR; kanal kapalıyken sıfır kalmalı ──────────────────
const dbCagrilari: string[] = [];
const sayimSonucu: Array<{ n: number }> = [{ n: 0 }];
const kullaniciSonucu: Array<{ id: string; name: string | null }> = [];

vi.mock('@/db/client', () => ({
  db: {
    select: (alanlar: Record<string, unknown>) => {
      const sayimMi = 'n' in (alanlar ?? {});
      dbCagrilari.push(sayimMi ? 'select:oran-sayimi' : 'select:kullanici');
      const zincir = {
        from: () => zincir,
        where: () => (sayimMi ? Promise.resolve(sayimSonucu) : zincir),
        limit: () => Promise.resolve(kullaniciSonucu),
      };
      return zincir;
    },
    insert: () => {
      dbCagrilari.push('insert:token');
      return { values: () => Promise.resolve() };
    },
  },
}));

vi.mock('@/db/schema', () => ({
  passwordResetTokens: { email: 'email', createdAt: 'created_at' },
  sessions: {},
  users: { id: 'id', name: 'name', email: 'email' },
}));

vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  gt: (...a: unknown[]) => a,
  isNull: (...a: unknown[]) => a,
  sql: Object.assign(() => 'sql', { raw: () => 'sql' }),
}));

vi.mock('@/lib/email/templates', () => ({
  passwordResetEmail: () => ({ subject: 'k', html: 'h', text: 't' }),
}));

vi.mock('@/lib/password', () => ({
  hashPassword: async () => 'hash',
  validatePassword: () => ({ ok: true }),
}));

// actions/auth → @/lib/auth → next-auth zincirini kes: next-auth Node test
// ortamında yüklenemiyor ve bu testin konusu değil.
vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }));
vi.mock('@/lib/customers/service', () => ({ upsertCustomerByEmail: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.7']]) as unknown as Headers,
}));

// sender GERÇEK modül: mailKanaliHazir'ı testin asıl konusu olduğu için
// taklit etmiyoruz — env'e bakıp doğru kararı verdiğini de ölçüyoruz.
const gonderilen: unknown[] = [];
vi.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async (p: unknown) => {
      gonderilen.push(p);
      return { messageId: 'smtp-1', rejected: [] };
    },
  }),
}));

const { mailKanaliHazir } = await import('@/lib/email/sender');
const { requestPasswordReset } = await import('@/lib/password-reset');
const { requestPasswordResetAction } = await import('@/lib/actions/auth');

function envSifirla() {
  for (const k of Object.keys(testEnv)) delete testEnv[k];
  testEnv.APP_URL = 'https://hesap.viamood.com.tr';
  testEnv.EMAIL_FROM = 'Via Mood <noreply@viamood.com>';
}

beforeEach(() => {
  envSifirla();
  dbCagrilari.length = 0;
  gonderilen.length = 0;
  sayimSonucu[0] = { n: 0 };
  kullaniciSonucu.length = 0;
});

describe('mailKanaliHazir — sağlayıcı algılama', () => {
  it('hiçbir anahtar yoksa KAPALI (canlı prod 16 Eyl durumu)', () => {
    expect(mailKanaliHazir()).toBe(false);
  });

  it('RESEND_API_KEY varsa AÇIK', () => {
    testEnv.RESEND_API_KEY = 're_test';
    expect(mailKanaliHazir()).toBe(true);
  });

  it('SMTP kullanıcı+şifre varsa AÇIK', () => {
    testEnv.SMTP_USER = 'u@x.com';
    testEnv.SMTP_PASS = 'abcd efgh ijkl mnop';
    expect(mailKanaliHazir()).toBe(true);
  });

  it('SMTP_HOST var ama kimlik yoksa KAPALI (yarım yapılandırma)', () => {
    testEnv.SMTP_HOST = 'smtp.gmail.com';
    expect(mailKanaliHazir()).toBe(false);
  });

  it('boşluktan ibaret anahtar KAPALI sayılır', () => {
    testEnv.RESEND_API_KEY = '   ';
    testEnv.SMTP_USER = '  ';
    testEnv.SMTP_PASS = '   ';
    expect(mailKanaliHazir()).toBe(false);
  });
});

describe('requestPasswordReset — kanal kapalıyken', () => {
  it('kanalKapali:true döner, mailGitti YALANI ile karışmaz', async () => {
    const r = await requestPasswordReset({ email: 'ayse@example.com' });
    expect(r).toEqual({ ok: true, kanalKapali: true });
  });

  it('DB’ye HİÇ dokunmaz — token yazmaz, oran sınırı sorgusu bile atmaz', async () => {
    await requestPasswordReset({ email: 'ayse@example.com' });
    expect(dbCagrilari).toEqual([]);
  });

  it('ORAN SINIRI TÜKETİLMEZ: arka arkaya 3 istek de aynı yanıtı alır', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await requestPasswordReset({ email: 'ayse@example.com' });
      expect(r).toEqual({ ok: true, kanalKapali: true });
    }
    expect(dbCagrilari).toEqual([]); // hiç satır yazılmadı → sınır hiç dolmadı
  });

  it('HESAP VARLIĞI SIZMAZ: kayıtlı ve kayıtsız adres AYNI yanıtı alır', async () => {
    kullaniciSonucu.push({ id: 'u1', name: 'Ayşe' }); // "kayıtlı" senaryo
    const kayitli = await requestPasswordReset({ email: 'ayse@example.com' });
    kullaniciSonucu.length = 0; // "kayıtsız" senaryo
    const kayitsiz = await requestPasswordReset({ email: 'yok@example.com' });
    expect(kayitli).toEqual(kayitsiz);
  });
});

describe('requestPasswordReset — kanal açıkken eski davranış korunur', () => {
  beforeEach(() => {
    testEnv.SMTP_USER = 'u@x.com';
    testEnv.SMTP_PASS = 'sifre';
  });

  it('kayıtlı adrese mail gider, kanalKapali işareti YOKTUR', async () => {
    kullaniciSonucu.push({ id: 'u1', name: 'Ayşe' });
    const r = await requestPasswordReset({ email: 'ayse@example.com' });
    expect(r).toMatchObject({ ok: true, mailGitti: true });
    expect('kanalKapali' in r && r.kanalKapali).toBeFalsy();
    expect(gonderilen).toHaveLength(1);
    expect(dbCagrilari).toContain('insert:token');
  });

  it('kayıtsız adreste satır yazılır ama mail gitmez (değişmez 1)', async () => {
    const r = await requestPasswordReset({ email: 'yok@example.com' });
    expect(r).toEqual({ ok: true, mailGitti: false });
    expect(gonderilen).toHaveLength(0);
    expect(dbCagrilari).toContain('insert:token');
  });

  it('oran sınırı hâlâ çalışır (5 dk içinde ikinci istek reddedilir)', async () => {
    sayimSonucu[0] = { n: 1 };
    const r = await requestPasswordReset({ email: 'ayse@example.com' });
    expect(r).toEqual({ ok: false, sebep: 'oran_siniri' });
  });
});

describe('requestPasswordResetAction — kullanıcıya dönen metin', () => {
  function fd(email: string) {
    const f = new FormData();
    f.set('email', email);
    return f;
  }

  it('KANAL KAPALI: yeşil onay metni YOK, dürüst uyarı VAR', async () => {
    const r = await requestPasswordResetAction(fd('ayse@example.com'));
    expect(r.success).toBe(true);
    const d = (r as { data: { kanalKapali?: boolean; message: string } }).data;
    expect(d.kanalKapali).toBe(true);
    expect(d.message).toContain('gönderemiyoruz');
    expect(d.message).toContain('destek@viamood.com');
    // ARIZANIN TA KENDİSİ: bu ifade artık ÇIKMAMALI.
    expect(d.message).not.toContain('gönderdik');
    expect(d.message).not.toContain('Gelen kutunu');
  });

  it('KANAL AÇIK: eski yeşil onay metni aynen korunur', async () => {
    testEnv.SMTP_USER = 'u@x.com';
    testEnv.SMTP_PASS = 'sifre';
    kullaniciSonucu.push({ id: 'u1', name: 'Ayşe' });
    const r = await requestPasswordResetAction(fd('ayse@example.com'));
    expect(r.success).toBe(true);
    const d = (r as { data: { kanalKapali?: boolean; message: string } }).data;
    expect(d.kanalKapali).toBeUndefined();
    expect(d.message).toContain('gönderdik');
  });

  it('geçersiz e-posta kanal kontrolünden ÖNCE reddedilir', async () => {
    const r = await requestPasswordResetAction(fd('bu-eposta-degil'));
    expect(r.success).toBe(false);
    expect(dbCagrilari).toEqual([]);
  });
});
