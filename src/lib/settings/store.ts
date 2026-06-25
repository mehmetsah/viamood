import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  storeSettings,
  type PaymentSettings,
  type ShippingSettings,
  type ThemeSettings,
} from '@/db/schema';
import { env } from '@/lib/env';

export type StoreBackend = 'shopify' | 'native';

export interface StoreSettings {
  backend: StoreBackend;
  payment: PaymentSettings;
  shipping: ShippingSettings;
  theme: ThemeSettings;
}

const DEFAULTS: StoreSettings = {
  backend: 'shopify',
  payment: {
    iyzico_enabled: true,
    paytr_enabled: false,
    havale_enabled: true,
    cod_enabled: true,
    card_gateway: 'iyzico',
    cod_card_surcharge_pct: 4,
  },
  shipping: { shipping_margin_tl: 20 },
  theme: {},
};

/** Tekil mağaza ayarlarını döndürür (yoksa varsayılan). Storefront/checkout/tema besler. */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1);
    if (!row) return DEFAULTS;
    return {
      backend: row.backend === 'native' ? 'native' : 'shopify',
      payment: { ...DEFAULTS.payment, ...(row.payment ?? {}) },
      shipping: { ...DEFAULTS.shipping, ...(row.shipping ?? {}) },
      theme: { ...DEFAULTS.theme, ...(row.theme ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Aktif sipariş backend'ini döndürür (admin switch'i). DB öncelikli; yoksa env.STORE_BACKEND.
 * `getStore()` bunu okur — admin'den anında değişir (redeploy gerekmez).
 */
export async function getActiveStoreBackend(): Promise<StoreBackend> {
  try {
    const [row] = await db
      .select({ backend: storeSettings.backend })
      .from(storeSettings)
      .where(eq(storeSettings.id, 'default'))
      .limit(1);
    if (row?.backend === 'native' || row?.backend === 'shopify') return row.backend;
  } catch {
    /* tablo/kolon yoksa env'e düş */
  }
  return env.STORE_BACKEND;
}
