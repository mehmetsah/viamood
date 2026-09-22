/**
 * Giriş ekranı — Facebook düğmesi (Mehmet, 21 Eyl 2026: "Google düğmesinin aynısı").
 *
 * Çivilenen dört şey:
 *  1) GÖRÜNÜRLÜK: Facebook düğmesi YALNIZ facebook sağlayıcısı etkinken çizilir.
 *     Zincirin tamamı ölçülür: store → getEnabledSocialProviders → sayfa (page.tsx)
 *     → istemci bileşen → HTML. Kimlik yoksa düğme YOK (negatif kanıt).
 *  2) BİREBİR KALIP: iki düğmenin açılış etiketi (sınıf dahil) ve iskeleti aynı,
 *     etiket kalıbı "<Ad> ile devam et"; sıra Google → Facebook; "veya" tek.
 *  3) DAVRANIŞ: tıklama signIn(<sağlayıcı>, { callbackUrl }) çağırır — iki
 *     düğmede de AYNI callbackUrl.
 *  4) BÖLGE KİLİDİ: sosyal bölgede yalnız etkin sağlayıcı sayısı kadar düğme
 *     var; başka düğme/bağlantı/girdi/görsel ya da emoji eklenirse kırılır.
 */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sahte depo: lib/auth/social.ts okuyucuları buradan beslenir ─────────────
const store = { auth: {} as Record<string, unknown> };
vi.mock('@/lib/settings/store', () => ({
  getStoreSettings: vi.fn(async () => ({ auth: store.auth })),
}));

const signInSahte = vi.fn();
vi.mock('next-auth/react', () => ({ signIn: (...a: unknown[]) => signInSahte(...a) }));

let arama = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => arama,
}));
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Sığ açılım (aşağıdaki `agac`) SignInInner'ı render dışında çağırır; useState
// orada dağıtıcısız kalır. Yalnız ilk değeri döndüren bir taklit yeterli —
// ölçülen şey düğmelerin props'u, durum geçişi değil.
vi.mock('react', async () => {
  const gercek = await vi.importActual<typeof import('react')>('react');
  return {
    ...gercek,
    useState: (v: unknown) => [typeof v === 'function' ? (v as () => unknown)() : v, () => {}],
  };
});

const { SignInClient, SosyalDugme } = await import('@/app/auth/sign-in/SignInClient');
const { default: SignInPage } = await import('@/app/auth/sign-in/page');

const G = { google_client_id: 'g-id', google_client_secret: 'g-sec' };
const F = { facebook_enabled: true, facebook_client_id: '1234567890', facebook_client_secret: 'f-sec' };

beforeEach(() => {
  store.auth = {};
  arama = new URLSearchParams();
  signInSahte.mockReset();
  for (const k of ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'AUTH_FACEBOOK_ID', 'AUTH_FACEBOOK_SECRET']) {
    delete process.env[k];
  }
});

/** Sayfayı GERÇEK zincirden çiz: store → okuyucu → page.tsx → SignInClient. */
async function sayfa(): Promise<string> {
  return renderToStaticMarkup(await SignInPage());
}

/** Sosyal bölge: başlıktan sonra, parola formundan önce. */
function bolge(html: string): string {
  const bas = html.indexOf('</h1>');
  const son = html.indexOf('<form');
  expect(bas).toBeGreaterThan(-1);
  expect(son).toBeGreaterThan(bas);
  return html.slice(bas, son);
}

function dugmeler(html: string): string[] {
  return [...bolge(html).matchAll(/<button[\s\S]*?<\/button>/g)].map((m) => m[0]);
}

/** Bir düğmenin iskeleti: işaretin çizgileri, viewBox'ı ve sağlayıcı adı dışındaki her şey. */
function iskelet(dugme: string): string {
  return dugme
    .replace(/<path[^>]*>(<\/path>)?/g, '')
    .replace(/viewBox="[^"]*"/, 'viewBox="*"')
    .replace(/(Google|Facebook) ile devam et/, '<AD> ile devam et');
}

describe('görünürlük — gerçek zincir (store → sayfa → HTML)', () => {
  it('Facebook kimliği YOKKEN düğme çizilmez (Google açık)', async () => {
    store.auth = { ...G };
    const html = await sayfa();
    expect(html).toContain('Google ile devam et');
    expect(html).not.toContain('Facebook ile devam et');
    expect(dugmeler(html)).toHaveLength(1);
  });

  it('facebook_enabled açık ama secret eksik → düğme YOK', async () => {
    store.auth = { ...G, facebook_enabled: true, facebook_client_id: '1234567890' };
    expect(await sayfa()).not.toContain('Facebook ile devam et');
  });

  it('kimlik tam ama "açık" işaretli değil → düğme YOK', async () => {
    store.auth = { ...G, facebook_client_id: '1234567890', facebook_client_secret: 'f-sec' };
    expect(await sayfa()).not.toContain('Facebook ile devam et');
  });

  it('Facebook açık + kimlik tam → düğme ÇİZİLİR', async () => {
    store.auth = { ...G, ...F };
    const html = await sayfa();
    expect(html).toContain('Facebook ile devam et');
    expect(dugmeler(html)).toHaveLength(2);
  });

  it('yalnız Facebook açıkken de düğme ve tek "veya" ayırıcısı çizilir', async () => {
    store.auth = { ...F };
    const html = await sayfa();
    expect(html).not.toContain('Google ile devam et');
    expect(dugmeler(html)).toHaveLength(1);
    expect(bolge(html).match(/>veya</g) ?? []).toHaveLength(1);
  });

  it('hiçbir sağlayıcı yokken sosyal bölge tamamen boş (ayırıcı da yok)', async () => {
    const html = await sayfa();
    expect(dugmeler(html)).toHaveLength(0);
    expect(bolge(html)).not.toContain('veya');
  });
});

describe('birebir kalıp — Facebook düğmesi Google düğmesinin aynısı', () => {
  const html = renderToStaticMarkup(<SignInClient sosyal={{ google: true, facebook: true }} />);
  const [g = '', f = ''] = dugmeler(html);

  it('sıra: önce Google, sonra Facebook', () => {
    expect(g).toContain('Google ile devam et');
    expect(f).toContain('Facebook ile devam et');
  });

  it('açılış etiketi (type + sınıf) BİREBİR aynı', () => {
    const acilis = (d: string) => d.match(/^<button[^>]*>/)?.[0];
    expect(acilis(f)).toBeDefined();
    expect(acilis(f)).toBe(acilis(g));
    expect(acilis(g)).toContain('rounded-full border-2 border-neutral-200 bg-white');
  });

  it('iskelet aynı: 18×18 aria-hidden işaret + "<Ad> ile devam et"', () => {
    expect(iskelet(f)).toBe(iskelet(g));
    expect(iskelet(g)).toMatch(/^<button[^>]*><svg width="18" height="18" viewBox="\*" aria-hidden="true"><\/svg><AD> ile devam et<\/button>$/);
  });

  it('Facebook işareti resmi mavi "f" (SVG çizgisi) — emoji ya da görsel değil', () => {
    expect(f).toContain('fill="#1877F2"');
    expect(f).not.toMatch(/<img/);
  });

  it('"veya" ayırıcısı iki düğme için TEK', () => {
    expect(bolge(html).match(/>veya</g) ?? []).toHaveLength(1);
  });
});

describe('bölge kilidi — sosyal bölgede başka öğe yok', () => {
  it('iki sağlayıcı açıkken: 2 düğme, 2 işaret, 0 bağlantı/girdi/görsel/emoji', () => {
    const b = bolge(renderToStaticMarkup(<SignInClient sosyal={{ google: true, facebook: true }} />));
    expect((b.match(/<button/g) ?? []).length).toBe(2);
    expect((b.match(/<svg/g) ?? []).length).toBe(2);
    expect((b.match(/<a[\s>]|<input|<select|<textarea|<img/g) ?? []).length).toBe(0);
    expect(b.replace(/<[^>]+>/g, '')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('davranış — tıklama signIn(sağlayıcı, { callbackUrl })', () => {
  /** Sığ açılım: yalnız SignInInner ve SosyalDugme açılır, host öğeler toplanır. */
  function agac(dugum: ReactNode, cikti: ReactElement[] = []): ReactElement[] {
    if (Array.isArray(dugum)) {
      for (const d of dugum) agac(d, cikti);
      return cikti;
    }
    if (!isValidElement(dugum)) return cikti;
    const el = dugum as ReactElement<{ children?: ReactNode }>;
    const tur = el.type as unknown;
    if (tur === SosyalDugme || (typeof tur === 'function' && tur.name === 'SignInInner')) {
      return agac((tur as (p: unknown) => ReactNode)(el.props), cikti);
    }
    cikti.push(el);
    agac(el.props.children, cikti);
    return cikti;
  }

  function sosyalDugmeleri(sosyal: { google: boolean; facebook: boolean }) {
    return agac(SignInClient({ sosyal })).filter(
      (e): e is ReactElement<{ onClick: () => void; children: ReactNode }> =>
        e.type === 'button' && typeof (e.props as { onClick?: unknown }).onClick === 'function',
    );
  }

  it('Google → signIn("google"), Facebook → signIn("facebook"), AYNI callbackUrl', () => {
    arama = new URLSearchParams('callbackUrl=/hesabim/siparisler');
    const d = sosyalDugmeleri({ google: true, facebook: true });
    expect(d).toHaveLength(2);
    for (const x of d) x.props.onClick();
    expect(signInSahte.mock.calls).toEqual([
      ['google', { callbackUrl: '/hesabim/siparisler' }],
      ['facebook', { callbackUrl: '/hesabim/siparisler' }],
    ]);
  });

  it('callbackUrl yoksa ikisi de /post-login\'e döner', () => {
    const d = sosyalDugmeleri({ google: true, facebook: true });
    for (const x of d) x.props.onClick();
    expect(signInSahte.mock.calls.map((c) => c[1])).toEqual([
      { callbackUrl: '/post-login' },
      { callbackUrl: '/post-login' },
    ]);
  });

  it('facebook kapalıyken tıklanabilir Facebook düğmesi YOK', () => {
    const d = sosyalDugmeleri({ google: true, facebook: false });
    expect(d).toHaveLength(1);
    d[0]!.props.onClick();
    expect(signInSahte.mock.calls).toEqual([['google', { callbackUrl: '/post-login' }]]);
  });
});
