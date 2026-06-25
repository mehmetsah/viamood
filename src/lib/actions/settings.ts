'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { storeSettings, type PaymentSettings, type ShippingSettings } from '@/db/schema';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'admin' && role !== 'super_admin') throw new Error('Yetkin yok');
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

  const payment: PaymentSettings = {
    iyzico_enabled: bool('iyzico_enabled'),
    paytr_enabled: bool('paytr_enabled'),
    havale_enabled: bool('havale_enabled'),
    cod_enabled: bool('cod_enabled'),
    card_gateway: formData.get('card_gateway') === 'paytr' ? 'paytr' : 'iyzico',
    cod_card_surcharge_pct: num('cod_card_surcharge_pct') ?? 4,
  };
  const shipping: ShippingSettings = {
    free_shipping_threshold: num('free_shipping_threshold'),
    default_courier: String(formData.get('default_courier') ?? '').trim() || undefined,
    shipping_margin_tl: num('shipping_margin_tl') ?? 20,
  };

  await db
    .insert(storeSettings)
    .values({ id: 'default', payment, shipping })
    .onConflictDoUpdate({
      target: storeSettings.id,
      set: { payment, shipping, updatedAt: new Date() },
    });

  revalidatePath('/admin/settings');
  redirect('/admin/settings?saved=1');
}
