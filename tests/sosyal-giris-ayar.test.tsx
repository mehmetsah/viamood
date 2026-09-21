/**
 * Yönetim → Sosyal Giriş ekranı: Google + Facebook kimlikleri.
 *
 * Çivilenen üç şey:
 *  1) KAYDETME: boş bırakılan secret mevcut değeri SİLMEZ (iki sağlayıcıda da),
 *     hatalı bir sağlayıcı hiçbir şeyi yazdırmaz, formda olmayan bölüm ellenmez.
 *  2) SIZINTI: secret ekrana (özet nesnesi, form HTML'i, sayfa HTML'i) düz İNMEZ.
 *  3) BÖLGE KİLİDİ: Facebook bölümü Google bölümünün BİREBİR kalıbı —
 *     aynı denetim dizisi, formda tek düğme (Kaydet). Fazladan öğe eklenirse kırılır.
 * Ayrıca: yönetim ekranının "açık" kuralı giriş ekranının okuyucusuyla
 * (getGoogleCreds / getFacebookCreds) aynı; Facebook yalnız açık + kimlik tamken görünür.
 * Yönetim notunun giriş ekranı hakkındaki cümleleri ÇİZİLEN giriş ekranıyla ölçülür.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSettings } from '@/db/schema';

// ── Ortak sahte depo (lib/auth/social.ts okuyucuları için) ──────────────────
const store = { auth: {} as AuthSettings };
vi.mock('@/lib/settings/store', () => ({
  getStoreSettings: vi.fn(async () => ({ auth: store.auth })),
}));

// Form bileşeni useActionState kullanıyor — gönderim öncesi hâl basılır.
vi.mock('react', async () => {
  const gercek = await vi.importActual<typeof import('react')>('react');
  return { ...gercek, useActionState: () => [null, () => {}, false] };
});

// Server action modülü DB/oturum çeker; ekran testinde yalnız OKU taklit edilir
// ve GERÇEK özet işleviyle beslenir (kopya mantık yok).
const oku = vi.fn();
vi.mock('@/lib/actions/social-auth', () => ({
  sosyalAyarlariOku: () => oku(),
  sosyalAyarlariKaydet: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { role: 'admin' } })) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  // Giriş ekranı da bu dosyada çizilir (ekran metni testi) — istemci kancaları:
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

const {
  sosyalAyarBirlestir,
  sosyalAyarOzeti,
  saglayiciAcik,
  SOSYAL_SAGLAYICILAR,
} = await import('@/lib/auth/sosyal-ayar');
const { getGoogleCreds, getFacebookCreds, getEnabledSocialProviders } = await import('@/lib/auth/social');
const { SosyalGirisForm } = await import('@/app/admin/ayarlar/sosyal-giris/Form');
const { default: SosyalGirisAyarPage } = await import('@/app/admin/ayarlar/sosyal-giris/page');
const { default: SignInPage } = await import('@/app/auth/sign-in/page');

const G_SECRET = 'GOCSPX-cok-gizli-google-A1B2';
const F_SECRET = 'fb0123456789abcdefgizliF9E8';
const KAYITLI: AuthSettings = {
  google_enabled: true,
  google_client_id: 'g-id.apps.googleusercontent.com',
  google_client_secret: G_SECRET,
  facebook_enabled: true,
  facebook_client_id: '1234567890123456',
  facebook_client_secret: F_SECRET,
};

function form(alanlar: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(alanlar)) fd.set(k, v);
  return fd;
}

/** Ekrandaki formun tam gönderimi: iki bölüm de var, secret alanları BOŞ. */
function tamForm(ek: Record<string, string> = {}): FormData {
  return form({
    google_enabled: 'on',
    google_client_id: KAYITLI.google_client_id!,
    google_client_secret: '',
    facebook_enabled: 'on',
    facebook_client_id: KAYITLI.facebook_client_id!,
    facebook_client_secret: '',
    ...ek,
  });
}

beforeEach(() => {
  store.auth = {};
  for (const k of ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'AUTH_FACEBOOK_ID', 'AUTH_FACEBOOK_SECRET']) {
    delete process.env[k];
  }
});

describe('kaydetme — boş secret mevcudu KORUR', () => {
  it('iki secret da boş gönderilince ikisi de aynen kalır', () => {
    const s = sosyalAyarBirlestir(KAYITLI, tamForm());
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.yeni.google_client_secret).toBe(G_SECRET);
    expect(s.yeni.facebook_client_secret).toBe(F_SECRET);
  });

  it('Facebook secret boş, yalnız App ID değişti → secret korunur, ID güncellenir', () => {
    const s = sosyalAyarBirlestir(KAYITLI, tamForm({ facebook_client_id: '999' }));
    expect(s.ok && s.yeni.facebook_client_id).toBe('999');
    expect(s.ok && s.yeni.facebook_client_secret).toBe(F_SECRET);
  });

  it('yeni secret yazılırsa eskisinin yerine geçer', () => {
    const s = sosyalAyarBirlestir(KAYITLI, tamForm({ facebook_client_secret: '  yeni-fb-secret  ' }));
    expect(s.ok && s.yeni.facebook_client_secret).toBe('yeni-fb-secret');
    expect(s.ok && s.yeni.google_client_secret).toBe(G_SECRET);
  });

  it('kutu kapatılınca kapanır ama secret yine SİLİNMEZ', () => {
    const fd = tamForm();
    fd.delete('facebook_enabled');
    const s = sosyalAyarBirlestir(KAYITLI, fd);
    expect(s.ok && s.yeni.facebook_enabled).toBe(false);
    expect(s.ok && s.yeni.facebook_client_secret).toBe(F_SECRET);
  });

  it('formda Facebook bölümü hiç yoksa (eski sayfa) Facebook kaydına dokunulmaz', () => {
    const s = sosyalAyarBirlestir(
      KAYITLI,
      form({ google_enabled: 'on', google_client_id: 'g2', google_client_secret: '' }),
    );
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.yeni.google_client_id).toBe('g2');
    expect(s.yeni.facebook_enabled).toBe(true);
    expect(s.yeni.facebook_client_id).toBe(KAYITLI.facebook_client_id);
    expect(s.yeni.facebook_client_secret).toBe(F_SECRET);
  });
});

describe('kaydetme — doğrulama', () => {
  it('Facebook açık + App ID boş → hata', () => {
    const s = sosyalAyarBirlestir(KAYITLI, tamForm({ facebook_client_id: '' }));
    expect(s).toEqual({ ok: false, hata: 'Facebook açıkken App ID zorunlu' });
  });

  it('Facebook açık + hiç kayıtlı secret yok + boş → hata', () => {
    const s = sosyalAyarBirlestir({}, form({ facebook_enabled: 'on', facebook_client_id: '1', facebook_client_secret: '' }));
    expect(s).toEqual({ ok: false, hata: 'Facebook açıkken App Secret zorunlu' });
  });

  it('Google mesajları değişmedi', () => {
    expect(sosyalAyarBirlestir({}, form({ google_enabled: 'on', google_client_id: '' })))
      .toEqual({ ok: false, hata: 'Google açıkken Client ID zorunlu' });
    expect(sosyalAyarBirlestir({}, form({ google_enabled: 'on', google_client_id: 'x', google_client_secret: '' })))
      .toEqual({ ok: false, hata: 'Google açıkken Client Secret zorunlu' });
  });

  it('bir sağlayıcı hatalıysa öteki de YAZILMAZ (sonuç bütünüyle ret)', () => {
    const s = sosyalAyarBirlestir(KAYITLI, tamForm({ google_client_id: 'degisti', facebook_client_id: '' }));
    expect(s.ok).toBe(false);
    expect('yeni' in s).toBe(false);
  });

  it('Facebook kapalıyken kimliksiz kayıt serbest (yarım bırakılabilir)', () => {
    const s = sosyalAyarBirlestir({}, form({ facebook_client_id: '', facebook_client_secret: '' }));
    expect(s.ok && s.yeni.facebook_enabled).toBe(false);
  });
});

describe('sızıntı — secret ekrana düz inmez', () => {
  it('özet nesnesinde düz secret YOK, son 4 hane maskeli var', () => {
    const o = sosyalAyarOzeti(KAYITLI, {});
    const json = JSON.stringify(o);
    expect(json).not.toContain(G_SECRET);
    expect(json).not.toContain(F_SECRET);
    expect(json).not.toContain('gizli');
    expect(o.facebook.secret_var).toBe(true);
    expect(o.facebook.secret_maskeli.endsWith('F9E8')).toBe(true);
    expect(o.google.secret_maskeli.endsWith('A1B2')).toBe(true);
  });

  it('form HTML\'inde düz secret YOK, secret alanlarında value YOK', () => {
    const html = renderToStaticMarkup(<SosyalGirisForm ayar={sosyalAyarOzeti(KAYITLI, {})} />);
    expect(html).not.toContain(G_SECRET);
    expect(html).not.toContain(F_SECRET);
    expect(html).not.toContain('gizli');
    for (const p of SOSYAL_SAGLAYICILAR) {
      const secret = html.match(new RegExp(`<input[^>]*name="${p}_client_secret"[^>]*>`))?.[0] ?? '';
      expect(secret).toContain('type="password"');
      expect(secret).not.toMatch(/\svalue=/);
    }
  });

  it('sayfanın tamamında düz secret YOK', async () => {
    oku.mockResolvedValue(sosyalAyarOzeti(KAYITLI, {}));
    const html = renderToStaticMarkup(await SosyalGirisAyarPage());
    expect(html).not.toContain(G_SECRET);
    expect(html).not.toContain(F_SECRET);
    expect(html).toContain('Facebook App ID');
  });

  it('env Facebook için doluysa uyarı Facebook adıyla çıkar, Google için çıkmaz', async () => {
    oku.mockResolvedValue(sosyalAyarOzeti(KAYITLI, { AUTH_FACEBOOK_ID: 'a', AUTH_FACEBOOK_SECRET: 'b' }));
    const html = renderToStaticMarkup(await SosyalGirisAyarPage());
    expect(html).toContain('AUTH_FACEBOOK_ID/SECRET');
    expect(html).not.toContain('AUTH_GOOGLE_ID/SECRET');
  });
});

describe('bölge kilidi — Facebook bölümü Google\'ın birebir kalıbı', () => {
  /** Bir sağlayıcının denetim dizisi: [etiket, tür] — ad önekinden bağımsız. */
  function denetimler(html: string, p: string): string[] {
    return [...html.matchAll(/<input[^>]*>/g)]
      .map((m) => m[0])
      .filter((t) => t.includes(`name="${p}_`))
      .map((t) => `${t.match(/name="[a-z]+_([a-z_]+)"/)?.[1]}:${t.match(/type="([a-z]+)"/)?.[1] ?? 'text'}`);
  }

  const html = renderToStaticMarkup(<SosyalGirisForm ayar={sosyalAyarOzeti({}, {})} />);

  it('Google denetimleri beklenen üçlü', () => {
    expect(denetimler(html, 'google')).toEqual(['enabled:checkbox', 'client_id:text', 'client_secret:password']);
  });

  it('Facebook denetimleri Google ile AYNI dizi', () => {
    expect(denetimler(html, 'facebook')).toEqual(denetimler(html, 'google'));
  });

  it('formda başka girdi YOK, tek düğme var (Kaydet)', () => {
    expect((html.match(/<input/g) ?? []).length).toBe(6);
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    expect((html.match(/<select|<textarea/g) ?? []).length).toBe(0);
  });

  it('Facebook etiketleri görünür', () => {
    const metin = html.replace(/<[^>]+>/g, ' ');
    expect(metin).toContain('Facebook ile giriş açık');
    expect(metin).toContain('Facebook App ID');
    expect(metin).toContain('Facebook App Secret');
  });
});

describe('yönetim ekranı ↔ giriş ekranı aynı kuralı okur', () => {
  it('"açık" kuralı okuyucularla birebir (enabled: yok / true / false)', async () => {
    for (const durum of [undefined, true, false]) {
      store.auth = {
        google_enabled: durum, google_client_id: 'g', google_client_secret: 'gs',
        facebook_enabled: durum, facebook_client_id: 'f', facebook_client_secret: 'fs',
      };
      expect(saglayiciAcik('google', store.auth)).toBe(Boolean(await getGoogleCreds()));
      expect(saglayiciAcik('facebook', store.auth)).toBe(Boolean(await getFacebookCreds()));
    }
  });

  it('Facebook YALNIZ açık + App ID + Secret tamken görünür', async () => {
    store.auth = { facebook_enabled: true, facebook_client_id: '1', facebook_client_secret: 's' };
    expect((await getEnabledSocialProviders()).facebook).toBe(true);
    store.auth = { facebook_enabled: true, facebook_client_id: '1' };
    expect((await getEnabledSocialProviders()).facebook).toBe(false);
    store.auth = { facebook_client_id: '1', facebook_client_secret: 's' };
    expect((await getEnabledSocialProviders()).facebook).toBe(false);
  });

  it('kaydet → okuyucu zinciri: kaydedilen Facebook kimliği okuyucudan aynen çıkar', async () => {
    const s = sosyalAyarBirlestir({}, form({ facebook_enabled: 'on', facebook_client_id: '42', facebook_client_secret: 'sek' }));
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    store.auth = s.yeni;
    expect(await getFacebookCreds()).toEqual({ clientId: '42', clientSecret: 'sek' });
  });
});

describe('ekran metni gerçeği söylüyor', () => {
  /**
   * Yönetim notu giriş ekranı hakkında İKİ şey söylüyor: (a) kimlik tamken
   * "Facebook ile devam et" düğmesi görünür, (b) kimlik eksikse gizli kalır.
   * İkisi de KAYNAK metinde değil, ÇİZİLEN giriş ekranında ölçülür — düğme
   * bağlantısı koptuğu gün not yalan söylemeye başlar ve bu test kırılır.
   */
  const metin = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  async function ekranlar(auth: AuthSettings) {
    store.auth = auth;
    const giris = renderToStaticMarkup(await SignInPage());
    oku.mockResolvedValue(sosyalAyarOzeti(auth, {}));
    const yonetim = metin(renderToStaticMarkup(await SosyalGirisAyarPage()));
    return { giris, yonetim };
  }

  it('kimlik tamken giriş ekranında Facebook düğmesi VAR ve not bunu söylüyor', async () => {
    const { giris, yonetim } = await ekranlar(KAYITLI);
    const bagli = giris.includes('Facebook ile devam et');
    expect(bagli).toBe(true);
    expect(yonetim.includes('henüz bağlı değil')).toBe(!bagli);
    expect(yonetim).toContain('Facebook ile devam et düğmesi görünür');
  });

  it('kimlik eksikken giriş ekranında düğme YOK ve not "gizli kalır" diyor', async () => {
    const { giris, yonetim } = await ekranlar({ ...KAYITLI, facebook_client_secret: '' });
    expect(giris).not.toContain('Facebook ile devam et');
    expect(yonetim).toContain('kimlik eksikse düğme gizli kalır');
  });

  it('"Apple sonraya bırakıldı" — giriş ekranında Apple düğmesi YOK', async () => {
    const { giris, yonetim } = await ekranlar(KAYITLI);
    expect(yonetim).toContain('Apple sonraya bırakıldı');
    expect(giris).not.toContain('Apple');
  });
});
