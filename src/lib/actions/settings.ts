'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import {
  storeSettings,
  type PaymentSettings,
  type ShippingSettings,
  type ThemeSettings,
} from '@/db/schema';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'admin' && role !== 'super_admin') throw new Error('Yetkin yok');
}

async function currentTheme(): Promise<ThemeSettings> {
  const [row] = await db.select({ theme: storeSettings.theme }).from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1);
  return (row?.theme as ThemeSettings) ?? {};
}

function revalidateStorefront() {
  revalidatePath('/magaza', 'layout');
  revalidatePath('/', 'layout');
}

export async function updateStoreSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const bool = (n: string) => {
    const v = formData.get(n);
    return v === 'on' || v === '1' || v === 'true';
  };
  const num = (n: string): number | undefined => {
    const raw = formData.get(n);
    if (raw == null || String(raw).trim() === '') return undefined;
    const v = Number(raw);
    return Number.isFinite(v) ? v : undefined;
  };

  const str = (n: string) => { const v = String(formData.get(n) ?? '').trim(); return v || undefined; };
  const [exRow] = await db.select({ payment: storeSettings.payment }).from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1);
  const exPay = (exRow?.payment as PaymentSettings) ?? {};
  const payment: PaymentSettings = {
    iyzico_enabled: bool('iyzico_enabled'),
    paytr_enabled: bool('paytr_enabled'),
    havale_enabled: bool('havale_enabled'),
    cod_enabled: bool('cod_enabled'),
    card_gateway: formData.get('card_gateway') === 'paytr' ? 'paytr' : 'iyzico',
    cod_card_surcharge_pct: num('cod_card_surcharge_pct') ?? 4,
    paytr_merchant_id: str('paytr_merchant_id') ?? exPay.paytr_merchant_id,
    paytr_merchant_key: str('paytr_merchant_key') ?? exPay.paytr_merchant_key,
    paytr_merchant_salt: str('paytr_merchant_salt') ?? exPay.paytr_merchant_salt,
    paytr_test_mode: bool('paytr_test_mode') ? 1 : 0,
    iyzico_api_key: str('iyzico_api_key') ?? exPay.iyzico_api_key,
    iyzico_secret_key: str('iyzico_secret_key') ?? exPay.iyzico_secret_key,
    iyzico_test_mode: bool('iyzico_test_mode') ? 1 : 0,
  };
  const shipping: ShippingSettings = {
    free_shipping_all: bool('free_shipping_all'),
    free_shipping_threshold: num('free_shipping_threshold'),
    default_courier: String(formData.get('default_courier') ?? '').trim() || undefined,
    shipping_margin_tl: num('shipping_margin_tl') ?? 20,
  };

  // Altyapı switch'i (yüksek etki): native → siparişler RDS'e (Shopify'a değil)
  const backend = formData.get('backend') === 'native' ? 'native' : 'shopify';

  await db
    .insert(storeSettings)
    .values({ id: 'default', backend, payment, shipping })
    .onConflictDoUpdate({
      target: storeSettings.id,
      set: { backend, payment, shipping, updatedAt: new Date() },
    });

  revalidatePath('/admin/settings');
  redirect('/admin/settings?saved=1');
}

export async function saveThemeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const str = (n: string) => {
    const v = String(formData.get(n) ?? '').trim();
    return v || undefined;
  };
  const existing = await currentTheme();
  const theme: ThemeSettings = {
    ...existing, // homeSections + pages korunur
    brand_primary: str('brand_primary'),
    brand_ink: str('brand_ink'),
    announcement: str('announcement'),
    announcement_enabled: formData.get('announcement_enabled') === 'on',
    hero_title: str('hero_title'),
    hero_subtitle: str('hero_subtitle'),
    hero_image: str('hero_image'),
    hero_cta_text: str('hero_cta_text'),
    hero_cta_link: str('hero_cta_link'),
    footer_text: str('footer_text'),
  };

  await db
    .insert(storeSettings)
    .values({ id: 'default', theme })
    .onConflictDoUpdate({ target: storeSettings.id, set: { theme, updatedAt: new Date() } });

  revalidatePath('/admin/theme');
  revalidateStorefront();
  redirect('/admin/theme?saved=1');
}

/** Section editöründen anasayfa bölümlerini kaydeder (JSON config). */
export async function saveHomeSectionsAction(configJson: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    return { ok: false, error: 'geçersiz JSON' };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: 'config dizi olmalı' };

  const existing = await currentTheme();
  const theme: ThemeSettings = { ...existing, homeSections: parsed };
  await db
    .insert(storeSettings)
    .values({ id: 'default', theme })
    .onConflictDoUpdate({ target: storeSettings.id, set: { theme, updatedAt: new Date() } });

  revalidateStorefront();
  return { ok: true };
}

/** Mega-menü (üst nav) config'ini kaydeder (JSON: NavItem[]). */
export async function saveMenuAction(configJson: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    return { ok: false, error: 'geçersiz JSON' };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: 'menu dizi olmalı' };
  const existing = await currentTheme();
  const theme: ThemeSettings = { ...existing, menu: parsed };
  await db
    .insert(storeSettings)
    .values({ id: 'default', theme })
    .onConflictDoUpdate({ target: storeSettings.id, set: { theme, updatedAt: new Date() } });
  revalidateStorefront();
  return { ok: true };
}

/** Footer (link sütunları + marka/iletişim) kaydeder. */
export async function saveFooterAction(payload: {
  footerCols?: { heading: string; links: { label: string; url: string }[] }[];
  footer_desc?: string;
  footer_phone?: string;
  footer_email?: string;
  footer_address?: string;
  footer_instagram?: string;
}): Promise<{ ok: boolean }> {
  await requireAdmin();
  const existing = await currentTheme();
  const theme: ThemeSettings = { ...existing, ...payload };
  await db
    .insert(storeSettings)
    .values({ id: 'default', theme })
    .onConflictDoUpdate({ target: storeSettings.id, set: { theme, updatedAt: new Date() } });
  revalidateStorefront();
  return { ok: true };
}

/** İçerik sayfası (slug) içeriğini kaydeder. */
export async function savePageAction(slug: string, title: string, html: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const existing = await currentTheme();
  const pages = { ...(existing.pages ?? {}), [slug]: { title, html } };
  const theme: ThemeSettings = { ...existing, pages };
  await db
    .insert(storeSettings)
    .values({ id: 'default', theme })
    .onConflictDoUpdate({ target: storeSettings.id, set: { theme, updatedAt: new Date() } });
  revalidatePath(`/sayfa/${slug}`);
  return { ok: true };
}
