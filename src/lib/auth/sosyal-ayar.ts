/**
 * Sosyal giriş ayarları — SAF mantık (DB / oturum / Next yok).
 *
 * Yönetim ekranı (`/admin/ayarlar/sosyal-giris`) ve server action
 * (`lib/actions/social-auth.ts`) bu dosyayı kullanır; testler de AYNI işlevleri
 * koşturur — kopya mantık yok.
 *
 * İki sağlayıcı BİREBİR aynı kurala tabidir:
 *  · Secret ekrana hiçbir zaman düz inmez; yalnız maskeli özet (`maskele`) iner.
 *  · Secret alanı BOŞ gönderilirse mevcut değer KORUNUR ("Kaydet"e basınca silinmesin).
 *  · Formda bir sağlayıcının bölümü hiç yoksa o sağlayıcının kaydına DOKUNULMAZ.
 *  · Açıkken kimlik ve secret zorunludur.
 *
 * ⚠️ İstemci bileşeni de bu dosyayı içe aktarır: buraya DB/sunucu importu koyma.
 */
import type { AuthSettings } from '@/db/schema';

export const SOSYAL_SAGLAYICILAR = ['google', 'facebook'] as const;
export type SosyalSaglayici = (typeof SOSYAL_SAGLAYICILAR)[number];

/** Ekranda ve hata mesajlarında kullanılan adlar — tek kaynak. */
export const SAGLAYICI_ETIKET: Record<
  SosyalSaglayici,
  {
    ad: string;
    kimlik: string;
    anahtar: string;
    kimlikOrnek: string;
    anahtarOrnek: string;
    anahtarKaynak: string;
    env: readonly [string, string];
  }
> = {
  google: {
    ad: 'Google',
    kimlik: 'Client ID',
    anahtar: 'Client Secret',
    kimlikOrnek: '…apps.googleusercontent.com',
    anahtarOrnek: 'GOCSPX-…',
    anahtarKaynak: 'Google Cloud Console → Credentials ekranından alınır.',
    env: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'],
  },
  facebook: {
    ad: 'Facebook',
    kimlik: 'App ID',
    anahtar: 'App Secret',
    kimlikOrnek: 'Yalnız rakamlardan oluşur',
    anahtarOrnek: '32 haneli anahtar',
    anahtarKaynak: 'Meta for Developers → Uygulama ayarları → Temel ekranından alınır.',
    env: ['AUTH_FACEBOOK_ID', 'AUTH_FACEBOOK_SECRET'],
  },
};

const ALAN = {
  google: { acik: 'google_enabled', id: 'google_client_id', secret: 'google_client_secret' },
  facebook: { acik: 'facebook_enabled', id: 'facebook_client_id', secret: 'facebook_client_secret' },
} as const satisfies Record<
  SosyalSaglayici,
  { acik: keyof AuthSettings; id: keyof AuthSettings; secret: keyof AuthSettings }
>;

function temiz(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Sağlayıcı açık mı? `lib/auth/social.ts` okuyucularıyla AYNI kural:
 * Google varsayılan AÇIK (`!== false`), Facebook varsayılan KAPALI (`=== true`).
 * (Uyum testle çivili: tests/sosyal-giris-ayar.test.ts)
 */
export function saglayiciAcik(p: SosyalSaglayici, a: AuthSettings): boolean {
  return p === 'google' ? a.google_enabled !== false : a.facebook_enabled === true;
}

/** Secret'i ekranda göstermek için maskeler: "••••••••abcd" (son 4 hane). */
export function maskele(v?: string | null): string {
  const s = temiz(v);
  if (!s) return '';
  return `${'•'.repeat(Math.max(8, Math.min(s.length - 4, 24)))}${s.slice(-4)}`;
}

export type SaglayiciOzeti = {
  acik: boolean;
  kimlik: string;
  secret_maskeli: string;
  secret_var: boolean;
  env_ile_geliyor: boolean;
};

export type SosyalAyarOzeti = Record<SosyalSaglayici, SaglayiciOzeti>;

/**
 * Ekrana inecek GÜVENLİ özet. Secret yalnız maskeli döner; düz değer bu
 * nesnede HİÇBİR alanda yoktur (sayfa bunu istemci bileşenine prop olarak
 * geçirir, yani nesnenin tamamı HTML'e serileşir).
 */
export function sosyalAyarOzeti(
  a: AuthSettings,
  env: Record<string, string | undefined>,
): SosyalAyarOzeti {
  const ozet = {} as SosyalAyarOzeti;
  for (const p of SOSYAL_SAGLAYICILAR) {
    const k = ALAN[p];
    const [envId, envSecret] = SAGLAYICI_ETIKET[p].env;
    ozet[p] = {
      acik: saglayiciAcik(p, a),
      kimlik: temiz(a[k.id]),
      secret_maskeli: maskele(a[k.secret]),
      secret_var: Boolean(temiz(a[k.secret])),
      env_ile_geliyor: Boolean(temiz(env[envId]) && temiz(env[envSecret])),
    };
  }
  return ozet;
}

export type BirlesimSonuc = { ok: true; yeni: AuthSettings } | { ok: false; hata: string };

/**
 * Formu mevcut kayıtla birleştirir. Bir sağlayıcıda hata varsa HİÇBİR şey
 * yazılmaz (sonuç `ok:false`), diğer sağlayıcı da değişmez.
 */
export function sosyalAyarBirlestir(mevcut: AuthSettings, fd: FormData): BirlesimSonuc {
  const yeni: AuthSettings = { ...mevcut };
  for (const p of SOSYAL_SAGLAYICILAR) {
    const k = ALAN[p];
    // Bu sağlayıcının bölümü formda yoksa (eski sayfa, başka bir form) dokunma.
    if (!fd.has(k.id)) continue;

    const { ad, kimlik, anahtar } = SAGLAYICI_ETIKET[p];
    const clientId = String(fd.get(k.id) ?? '').trim();
    const yeniSecret = String(fd.get(k.secret) ?? '').trim();
    const acik = fd.get(k.acik) === 'on';

    if (acik && !clientId) return { ok: false, hata: `${ad} açıkken ${kimlik} zorunlu` };

    // Secret boş bırakıldıysa MEVCUDU KORU — "kaydet"e basınca silinmesin.
    const secret = yeniSecret || temiz(mevcut[k.secret]);
    if (acik && !secret) return { ok: false, hata: `${ad} açıkken ${anahtar} zorunlu` };

    yeni[k.acik] = acik;
    yeni[k.id] = clientId;
    yeni[k.secret] = secret;
  }
  return { ok: true, yeni };
}
