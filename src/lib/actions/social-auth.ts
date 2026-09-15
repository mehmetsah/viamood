'use server';

/**
 * Sosyal giriş ayarları — admin server action'ları.
 *
 * GÜVENLİK:
 *  · Yetki HER action'da SUNUCUDA doğrulanır (istemciye güvenilmez).
 *  · CSRF: Server Actions Origin/Host eşitliğini zorlar (Next.js yerleşik) —
 *    sahte Origin'li istek "Aborting the action" ile reddedilir.
 *  · Secret hiçbir zaman düz DÖNMEZ; okuma yolu yalnız maskeli özet verir.
 *  · Secret alanı BOŞ gönderilirse mevcut değer KORUNUR (yanlışlıkla silinmesin).
 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeSettings, type AuthSettings } from '@/db/schema';
import { auth } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings/store';
import { maskele } from '@/lib/auth/social';

export type ActionSonuc = { ok: true } | { ok: false; hata: string };

/** Yalnız admin / super_admin. Başka herkes 403 alır. */
async function adminSart(): Promise<void> {
  const session = await auth();
  const rol = session?.user?.role;
  if (rol !== 'admin' && rol !== 'super_admin') {
    throw new Error('403 — bu ekran yalnız yöneticilere açık');
  }
}

/** Ekranda gösterilecek GÜVENLİ özet. Secret asla düz dönmez. */
export async function sosyalAyarlariOku(): Promise<{
  google_enabled: boolean;
  google_client_id: string;
  google_secret_maskeli: string;
  google_secret_var: boolean;
  env_ile_geliyor: boolean;
}> {
  await adminSart();
  const { auth: a } = await getStoreSettings();
  const envVar = Boolean(
    (process.env.AUTH_GOOGLE_ID ?? '').trim() && (process.env.AUTH_GOOGLE_SECRET ?? '').trim(),
  );
  return {
    google_enabled: a.google_enabled !== false,
    google_client_id: a.google_client_id ?? '',
    google_secret_maskeli: maskele(a.google_client_secret),
    google_secret_var: Boolean((a.google_client_secret ?? '').trim()),
    env_ile_geliyor: envVar,
  };
}

export async function sosyalAyarlariKaydet(formData: FormData): Promise<ActionSonuc> {
  try {
    await adminSart();
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : 'Yetkin yok' };
  }

  const clientId = String(formData.get('google_client_id') ?? '').trim();
  const yeniSecret = String(formData.get('google_client_secret') ?? '').trim();
  const acik = formData.get('google_enabled') === 'on';

  if (acik && !clientId) {
    return { ok: false, hata: 'Google açıkken Client ID zorunlu' };
  }

  const mevcut = (await getStoreSettings()).auth;
  // Secret boş bırakıldıysa MEVCUDU KORU — "kaydet"e basınca silinmesin.
  const secret = yeniSecret || mevcut.google_client_secret || '';

  if (acik && !secret) {
    return { ok: false, hata: 'Google açıkken Client Secret zorunlu' };
  }

  const yeni: AuthSettings = {
    ...mevcut,
    google_enabled: acik,
    google_client_id: clientId,
    google_client_secret: secret,
  };

  await db
    .insert(storeSettings)
    .values({ id: 'default', auth: yeni })
    .onConflictDoUpdate({ target: storeSettings.id, set: { auth: yeni } });

  revalidatePath('/admin/ayarlar/sosyal-giris');
  revalidatePath('/auth/sign-in');
  return { ok: true };
}
