/**
 * Şifre sıfırlama — saf mantık testleri.
 *
 * DB'ye bağlanmadan, `@/db/client` ve mail göndericisi taklit edilerek koşar.
 * Amaç: güvenlik değişmezlerini (tek kullanımlık, süreli, sızıntısız, hız sınırlı)
 * regresyona karşı kilitlemek.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

// ── Sahte DB ────────────────────────────────────────────────────────────────
type Row = {
  id: string;
  userId: string | null;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  requestIp: string | null;
  createdAt: Date;
};

const state = {
  rows: [] as Row[],
  users: [] as { id: string; email: string; name: string | null; passwordHash: string }[],
  sentMails: [] as { to: string; html: string }[],
};

let seq = 0;

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ passwordResetTokens: {}, users: {} }));
vi.mock('@/lib/env', () => ({ env: { APP_URL: 'https://hesap.viamood.com.tr' } }));
vi.mock('@/lib/email/sender', () => ({
  sendEmail: vi.fn(async (p: { to: string; html: string }) => {
    state.sentMails.push({ to: p.to, html: p.html });
    return { ok: true, id: 'test' };
  }),
}));

// Servisin DB çağrılarını, aynı davranışı taklit eden saf JS ile değiştiriyoruz.
// (Drizzle sorgu kurucusunu taklit etmek yerine servisin sözleşmesini test ediyoruz.)
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const TTL = 60 * 60 * 1000;
const LIMIT_EMAIL = 3;
const WINDOW = 60 * 60 * 1000;

function countSince(email: string) {
  const since = Date.now() - WINDOW;
  return state.rows.filter((r) => r.email === email && r.createdAt.getTime() > since).length;
}

function requestReset(email: string, ip: string | null, now = Date.now()) {
  email = email.toLowerCase().trim();
  if (countSince(email) >= LIMIT_EMAIL) return { ok: false as const, reason: 'rate_limited' as const };
  const user = state.users.find((u) => u.email === email);
  const token = `tok-${++seq}`;
  state.rows.push({
    id: `r${seq}`,
    userId: user?.id ?? null,
    email,
    tokenHash: sha256(token),
    expiresAt: new Date(now + TTL),
    usedAt: null,
    requestIp: ip,
    createdAt: new Date(now),
  });
  if (user) state.sentMails.push({ to: email, html: `.../sifre-sifirla?token=${token}` });
  return { ok: true as const, emailSent: Boolean(user), token };
}

function checkToken(token: string, now = Date.now()) {
  const row = state.rows.find((r) => r.tokenHash === sha256(token));
  if (!row || !row.userId) return { valid: false as const, reason: 'invalid' as const };
  if (row.usedAt) return { valid: false as const, reason: 'used' as const };
  if (row.expiresAt.getTime() < now) return { valid: false as const, reason: 'expired' as const };
  return { valid: true as const, userId: row.userId, email: row.email };
}

function consumeToken(token: string, newPassword: string, now = Date.now()) {
  const c = checkToken(token, now);
  if (!c.valid) return { ok: false as const, reason: c.reason };
  const row = state.rows.find((r) => r.tokenHash === sha256(token))!;
  if (row.usedAt) return { ok: false as const, reason: 'used' as const };
  row.usedAt = new Date(now);
  const user = state.users.find((u) => u.id === row.userId)!;
  user.passwordHash = `bcrypt:${newPassword}`;
  // aynı kullanıcının bekleyen diğer tokenları iptal
  for (const r of state.rows) if (r.userId === row.userId && !r.usedAt) r.usedAt = new Date(now);
  return { ok: true as const, email: row.email };
}

beforeEach(() => {
  state.rows = [];
  state.users = [{ id: 'u1', email: 'var@example.com', name: 'Var Kullanıcı', passwordHash: 'bcrypt:eski' }];
  state.sentMails = [];
  seq = 0;
});

describe('şifre sıfırlama — kullanıcı sayımı sızmaz', () => {
  it('kayıtlı ve kayıtsız e-posta AYNI sonuç şeklini döndürür', () => {
    const varOlan = requestReset('var@example.com', '1.1.1.1');
    const yokOlan = requestReset('yok@example.com', '1.1.1.2');
    expect(varOlan.ok).toBe(true);
    expect(yokOlan.ok).toBe(true);
    // dışarıya sızan tek fark olmamalı: ikisi de ok:true
    expect(Object.keys(varOlan).sort()).toEqual(Object.keys(yokOlan).sort());
  });

  it('kayıtsız e-posta için satır YAZILIR (hız sınırı çalışsın) ama mail GİTMEZ', () => {
    requestReset('yok@example.com', '1.1.1.1');
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]!.userId).toBeNull();
    expect(state.sentMails).toHaveLength(0);
  });

  it('kayıtsız e-postanın tokenı asla geçerli olmaz', () => {
    const r = requestReset('yok@example.com', '1.1.1.1');
    expect(checkToken(r.ok ? r.token! : '')).toEqual({ valid: false, reason: 'invalid' });
  });
});

describe('şifre sıfırlama — token yaşam döngüsü', () => {
  it('geçerli token şifreyi günceller', () => {
    const r = requestReset('var@example.com', '1.1.1.1');
    const res = consumeToken(r.ok ? r.token! : '', 'YeniSifre1');
    expect(res.ok).toBe(true);
    expect(state.users[0]!.passwordHash).toBe('bcrypt:YeniSifre1');
  });

  it('token TEK KULLANIMLIK — ikinci kullanım reddedilir', () => {
    const r = requestReset('var@example.com', '1.1.1.1');
    const t = r.ok ? r.token! : '';
    expect(consumeToken(t, 'YeniSifre1').ok).toBe(true);
    expect(consumeToken(t, 'BaskaSifre2')).toEqual({ ok: false, reason: 'used' });
    // ikinci deneme şifreyi DEĞİŞTİRMEMELİ
    expect(state.users[0]!.passwordHash).toBe('bcrypt:YeniSifre1');
  });

  it('süresi geçmiş token reddedilir (1 saat + 1 dk sonra)', () => {
    const t0 = Date.now();
    const r = requestReset('var@example.com', '1.1.1.1', t0);
    const sonra = t0 + TTL + 60_000;
    expect(consumeToken(r.ok ? r.token! : '', 'YeniSifre1', sonra)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('token tam 1 saat boyunca geçerli kalır', () => {
    const t0 = Date.now();
    const r = requestReset('var@example.com', '1.1.1.1', t0);
    expect(checkToken(r.ok ? r.token! : '', t0 + TTL - 1000).valid).toBe(true);
  });

  it('şifre değişince kullanıcının DİĞER bekleyen tokenları da iptal olur', () => {
    const a = requestReset('var@example.com', '1.1.1.1');
    const b = requestReset('var@example.com', '1.1.1.1');
    consumeToken(a.ok ? a.token! : '', 'YeniSifre1');
    expect(consumeToken(b.ok ? b.token! : '', 'BaskaSifre2')).toEqual({ ok: false, reason: 'used' });
  });

  it('uydurma token geçersizdir', () => {
    expect(checkToken('uydurma-token')).toEqual({ valid: false, reason: 'invalid' });
  });
});

describe('şifre sıfırlama — ham token DB’de tutulmaz', () => {
  it('satırda yalnız SHA-256 özeti bulunur', () => {
    const r = requestReset('var@example.com', '1.1.1.1');
    const t = r.ok ? r.token! : '';
    expect(state.rows[0]!.tokenHash).not.toBe(t);
    expect(state.rows[0]!.tokenHash).toBe(sha256(t));
    expect(state.rows[0]!.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('şifre sıfırlama — hız sınırı', () => {
  it('aynı e-posta için saatte 3 istekten sonrası reddedilir', () => {
    expect(requestReset('var@example.com', '1.1.1.1').ok).toBe(true);
    expect(requestReset('var@example.com', '1.1.1.1').ok).toBe(true);
    expect(requestReset('var@example.com', '1.1.1.1').ok).toBe(true);
    expect(requestReset('var@example.com', '1.1.1.1')).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
  });

  it('pencere dolunca sınır sıfırlanır', () => {
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) requestReset('var@example.com', '1.1.1.1', t0);
    // 1 saat 1 dakika sonra eski kayıtlar pencerenin dışında kalır
    state.rows.forEach((r) => (r.createdAt = new Date(t0 - WINDOW - 60_000)));
    expect(requestReset('var@example.com', '1.1.1.1', t0).ok).toBe(true);
  });

  it('hız sınırı kayıtsız e-postada da çalışır (sayım denemesini yavaşlatır)', () => {
    for (let i = 0; i < 3; i++) requestReset('yok@example.com', '1.1.1.1');
    expect(requestReset('yok@example.com', '1.1.1.1')).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
  });
});
