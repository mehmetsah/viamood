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
import { storeSettings } from '@/db/schema';
import { auth } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings/store';
import { sosyalAyarBirlestir, sosyalAyarOzeti, type SosyalAyarOzeti } from '@/lib/auth/sosyal-ayar';

export type ActionSonuc = { ok: true } | { ok: false; hata: string };

/** Yalnız admin / super_admin. Başka herkes 403 alır. */
async function adminSart(): Promise<void> {
  const session = await auth();
  const rol = session?.user?.role;
  if (rol !== 'admin' && rol !== 'super_admin') {
    throw new Error('403 — bu ekran yalnız yöneticilere açık');
  }
}

/**
 * Ekranda gösterilecek GÜVENLİ özet (Google + Facebook). Secret asla düz
 * dönmez — kural ve testi: lib/auth/sosyal-ayar.ts · tests/sosyal-giris-ayar.test.ts
 */
export async function sosyalAyarlariOku(): Promise<SosyalAyarOzeti> {
  await adminSart();
  const { auth: a } = await getStoreSettings();
  return sosyalAyarOzeti(a, process.env);
}

export async function sosyalAyarlariKaydet(formData: FormData): Promise<ActionSonuc> {
  try {
    await adminSart();
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : 'Yetkin yok' };
  }

  const mevcut = (await getStoreSettings()).auth;
  // Boş secret mevcudu korur; hata varsa hiçbir sağlayıcı yazılmaz.
  const sonuc = sosyalAyarBirlestir(mevcut, formData);
  if (!sonuc.ok) return sonuc;
  const yeni = sonuc.yeni;

  await db
    .insert(storeSettings)
    .values({ id: 'default', auth: yeni })
    .onConflictDoUpdate({ target: storeSettings.id, set: { auth: yeni } });

  revalidatePath('/admin/ayarlar/sosyal-giris');
  revalidatePath('/auth/sign-in');
  return { ok: true };
}
