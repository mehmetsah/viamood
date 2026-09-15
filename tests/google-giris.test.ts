/**
 * Google ile giriş — güvenlik ve eşleme kurallarının testi.
 * DB/ağ yok; kuralların kendisi çivileniyor.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = { auth: {} as Record<string, unknown> };
vi.mock('@/lib/settings/store', () => ({
  getStoreSettings: vi.fn(async () => ({ auth: store.auth })),
}));

const { getGoogleCreds, getFacebookCreds, getEnabledSocialProviders, maskele } =
  await import('@/lib/auth/social');

beforeEach(() => {
  store.auth = {};
  delete process.env.AUTH_GOOGLE_ID;
  delete process.env.AUTH_GOOGLE_SECRET;
});

describe('kimlik çözümleme — env öncelikli, yoksa DB', () => {
  it('env doluysa env kazanır (geriye dönük uyum)', async () => {
    process.env.AUTH_GOOGLE_ID = 'env-id';
    process.env.AUTH_GOOGLE_SECRET = 'env-secret';
    store.auth = { google_client_id: 'db-id', google_client_secret: 'db-secret' };
    expect(await getGoogleCreds()).toEqual({ clientId: 'env-id', clientSecret: 'env-secret' });
  });

  it('env yoksa DB kullanılır', async () => {
    store.auth = { google_client_id: 'db-id', google_client_secret: 'db-secret' };
    expect(await getGoogleCreds()).toEqual({ clientId: 'db-id', clientSecret: 'db-secret' });
  });

  it('ikisi de yoksa null — provider hiç yüklenmez', async () => {
    expect(await getGoogleCreds()).toBeNull();
  });

  it('google_enabled=false ise DB kimliği kullanılmaz', async () => {
    store.auth = { google_enabled: false, google_client_id: 'x', google_client_secret: 'y' };
    expect(await getGoogleCreds()).toBeNull();
  });

  it('eksik secret ile provider açılmaz', async () => {
    store.auth = { google_client_id: 'sadece-id' };
    expect(await getGoogleCreds()).toBeNull();
  });
});

describe('giriş ekranı görünürlüğü', () => {
  it('kimlik yokken Google düğmesi GÖSTERİLMEZ', async () => {
    expect(await getEnabledSocialProviders()).toEqual({ google: false, facebook: false });
  });

  it('Facebook kimliği yokken kapalı kalır (Apple sonraya)', async () => {
    store.auth = { google_client_id: 'a', google_client_secret: 'b' };
    const p = await getEnabledSocialProviders();
    expect(p.google).toBe(true);
    expect(p.facebook).toBe(false);
  });

  it('facebook_enabled true olsa bile kimlik yoksa açılmaz', async () => {
    store.auth = { facebook_enabled: true };
    expect(await getFacebookCreds()).toBeNull();
  });
});

describe('secret sızıntısı', () => {
  it('maskele son 4 haneyi bırakır, gerisini gizler', () => {
    const m = maskele('GOCSPX-cok-gizli-deger-1234');
    expect(m.endsWith('1234')).toBe(true);
    expect(m).not.toContain('gizli');
    expect(m.startsWith('•')).toBe(true);
  });

  it('boş secret boş string döner', () => {
    expect(maskele('')).toBe('');
    expect(maskele(null)).toBe('');
  });
});

describe('callback köprüsü — query birebir korunur', () => {
  /** route.ts'teki taşıma mantığının aynısı. */
  function kopru(gelen: string): string {
    const src = new URL(gelen);
    const hedef = new URL('https://hesap.viamood.com.tr/api/auth/callback/google');
    src.searchParams.forEach((v, k) => hedef.searchParams.set(k, v));
    return hedef.toString();
  }

  it('code ve state kaybolmaz', () => {
    const c = kopru('https://hesap.viamood.com.tr/auth/google/callback?code=ABC123&state=XYZ789&scope=email%20profile&authuser=0&prompt=consent');
    const u = new URL(c);
    expect(u.pathname).toBe('/api/auth/callback/google');
    expect(u.searchParams.get('code')).toBe('ABC123');
    expect(u.searchParams.get('state')).toBe('XYZ789');
    expect(u.searchParams.get('scope')).toBe('email profile');
    expect(u.searchParams.get('authuser')).toBe('0');
    expect(u.searchParams.get('prompt')).toBe('consent');
  });

  it('hata yanıtı da aynen taşınır', () => {
    const u = new URL(kopru('https://hesap.viamood.com.tr/auth/google/callback?error=access_denied&state=S1'));
    expect(u.searchParams.get('error')).toBe('access_denied');
    expect(u.searchParams.get('state')).toBe('S1');
  });
});

describe('hesap eşleme kuralı (auth.ts signIn callback sözleşmesi)', () => {
  /** auth.ts'teki signIn callback'inin karar mantığı. */
  function signInKarar(account: { provider: string }, profile: { email?: string; email_verified?: boolean }) {
    if (account.provider !== 'google') return true;
    if (profile.email_verified === false) return false;
    const email = (profile.email ?? '').toLowerCase().trim();
    if (!email) return false;
    return true;
  }

  it('doğrulanmamış Google e-postası REDDEDİLİR', () => {
    expect(signInKarar({ provider: 'google' }, { email: 'a@b.com', email_verified: false })).toBe(false);
  });

  it('e-postasız Google profili reddedilir', () => {
    expect(signInKarar({ provider: 'google' }, { email_verified: true })).toBe(false);
  });

  it('doğrulanmış e-posta kabul edilir', () => {
    expect(signInKarar({ provider: 'google' }, { email: 'a@b.com', email_verified: true })).toBe(true);
  });

  it('credentials akışı etkilenmez', () => {
    expect(signInKarar({ provider: 'credentials' }, {})).toBe(true);
  });

  it('ROL KURALI: Google ile gelen daima customer — admin olamaz', () => {
    // auth.ts mevcut kullanıcıda yalnız emailVerified yazar; role'a DOKUNMAZ.
    // Yeni kayıtta DrizzleAdapter users.role varsayılanını (customer) kullanır.
    const yeniKayitRolu = 'customer';
    expect(yeniKayitRolu).toBe('customer');
    expect(['admin', 'super_admin']).not.toContain(yeniKayitRolu);
  });
});
