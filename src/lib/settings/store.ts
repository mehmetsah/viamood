import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { storeSettings, type PaymentSettings, type ShippingSettings } from '@/db/schema';

export interface StoreSettings {
  payment: PaymentSettings;
  shipping: ShippingSettings;
}

const DEFAULTS: StoreSettings = {
  payment: {
    iyzico_enabled: true,
    paytr_enabled: false,
    havale_enabled: true,
    cod_enabled: true,
    card_gateway: 'iyzico',
    cod_card_surcharge_pct: 4,
  },
  shipping: { shipping_margin_tl: 20 },
};

/** Tekil mağaza ayarlarını döndürür (yoksa varsayılan). Storefront/checkout besler. */
export async function getStoreSettings(): Promise<StoreSettings> {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 'default')).limit(1);
  if (!row) return DEFAULTS;
  return {
    payment: { ...DEFAULTS.payment, ...(row.payment ?? {}) },
    shipping: { ...DEFAULTS.shipping, ...(row.shipping ?? {}) },
  };
}
