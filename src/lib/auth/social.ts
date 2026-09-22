/**
 * Sosyal giriş kimlikleri — ENV ÖNCELİKLİ, yoksa DB.
 *
 * NEDEN VAR: prod sunucuya SSH kapalı (13.62.159.252:22), `.env.production`
 * düzenlenemiyor. Kimlikler `/admin/ayarlar/sosyal-giris` ekranından HTTPS
 * üzerinden girilebilsin diye `store_settings.auth` jsonb'sinde tutulur.
 *
 * GERİYE DÖNÜK UYUMLU: env doluysa env kazanır — mevcut kurulumlar bozulmaz.
 *
 * ⚠️ Bu dosya NODE runtime'a aittir (DB'ye gider). Edge middleware'den
 * (auth.config.ts) ÇAĞIRMA — bcrypt/DB edge'de çalışmaz.
 */
import { getStoreSettings } from '@/lib/settings/store';

export type SocialCreds = { clientId: string; clientSecret: string } | null;

function temiz(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Google OAuth kimlikleri. Sırayla:
 *   1) process.env.AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
 *   2) store_settings.auth.google_client_id / _secret  (google_enabled şartı)
 * İkisi de yoksa null → provider hiç yüklenmez.
 */
export async function getGoogleCreds(): Promise<SocialCreds> {
  const envId = temiz(process.env.AUTH_GOOGLE_ID);
  const envSecret = temiz(process.env.AUTH_GOOGLE_SECRET);
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  try {
    const { auth } = await getStoreSettings();
    if (auth.google_enabled === false) return null;
    const id = temiz(auth.google_client_id);
    const secret = temiz(auth.google_client_secret);
    if (id && secret) return { clientId: id, clientSecret: secret };
  } catch {
    /* DB erişilemezse sosyal giriş kapalı kalır — parola girişi çalışmaya devam eder */
  }
  return null;
}

/**
 * Facebook — yer ayrıldı. Kimlik yokken giriş ekranında GÖSTERİLMEZ
 * (Yunus 10 Eyl: "Apple sonraya kalsın"; Facebook da kimlik gelene dek gizli).
 */
export async function getFacebookCreds(): Promise<SocialCreds> {
  const envId = temiz(process.env.AUTH_FACEBOOK_ID);
  const envSecret = temiz(process.env.AUTH_FACEBOOK_SECRET);
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  try {
    const { auth } = await getStoreSettings();
    if (auth.facebook_enabled !== true) return null;
    const id = temiz(auth.facebook_client_id);
    const secret = temiz(auth.facebook_client_secret);
    if (id && secret) return { clientId: id, clientSecret: secret };
  } catch {
    /* yoksay */
  }
  return null;
}

/** Giriş ekranı için: hangi sosyal sağlayıcılar kullanılabilir? (secret DÖNMEZ) */
export async function getEnabledSocialProviders(): Promise<{ google: boolean; facebook: boolean }> {
  const [g, f] = await Promise.all([getGoogleCreds(), getFacebookCreds()]);
  return { google: Boolean(g), facebook: Boolean(f) };
}

/** Maskeleme tek yerde yaşar (saf modül) — eski import yolu bozulmasın diye yeniden dışa verilir. */
export { maskele } from './sosyal-ayar';
