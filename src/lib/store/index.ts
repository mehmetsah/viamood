/**
 * StoreAdapter — commerce backend soyutlaması (FAZ 1 "adaptör sınırı").
 *
 * Amaç: storefront/checkout iş mantığını Shopify'a HARDWIRE etmek yerine bir arayüz arkasına almak.
 * Bugün tek implementasyon = ShopifyStoreAdapter (mevcut `lib/shopify/*` fonksiyonlarına delege eder;
 * davranış birebir aynı). Gerçek bir tetikleyici gelirse (ikinci mağaza / Shopify ToS / Plus zorlaması)
 * `NativeStoreAdapter` eklenir ve `getStore()` ona döner — çağrı noktaları (route'lar) DEĞİŞMEZ.
 *
 * Strateji: bkz. memory `viamood-strateji` — "adaptör SINIRINI çiz, native impl'i tetikleyiciye bağla".
 * Bugün native impl YAZMIYORUZ (YAGNI); sadece çıkış kapısını ucuza açık tutuyoruz.
 */
import { getActiveStoreBackend } from '../settings/store';
import {
  createStorefrontOrder,
  type StorefrontOrderBody,
  type StorefrontPaymentMethod,
  type CreatedOrder,
  type OrderErr,
} from '../shopify/create-storefront-order';
import { upsertCustomerAddress, type CustomerAddressInput } from '../shopify/customer-address';
import { createNativeStorefrontOrder } from './native-create-order';

export type { StorefrontOrderBody, StorefrontPaymentMethod, CreatedOrder, OrderErr, CustomerAddressInput };

export interface StoreAdapter {
  /** Hangi backend aktif (telemetri/log için). */
  readonly backend: string;
  /** Storefront custom checkout → gerçek "pending" sipariş (havale/COD). */
  createStorefrontOrder(
    body: StorefrontOrderBody,
    method: StorefrontPaymentMethod,
  ): Promise<CreatedOrder | OrderErr>;
  /** Müşteri adresini yapılandırılmış (il/ilçe/mahalle) adres defterine kaydet. */
  upsertCustomerAddress(input: CustomerAddressInput): Promise<void>;
}

/** Shopify backend — mevcut fonksiyonlara delege eder. */
const shopifyStoreAdapter: StoreAdapter = {
  backend: 'shopify',
  createStorefrontOrder,
  upsertCustomerAddress,
};

/**
 * Native backend (FAZ 2 Dilim 1) — sipariş RDS'e yazılır (havale+COD).
 * Adres yazımı FAZ 1 fonksiyonuna delege (RDS + best-effort Shopify) — değişmez.
 */
const nativeStoreAdapter: StoreAdapter = {
  backend: 'native',
  createStorefrontOrder: createNativeStorefrontOrder,
  upsertCustomerAddress,
};

/**
 * Aktif store backend'ini döndürür. Admin switch'i (`store_settings.backend`, DB) öncelikli;
 * yoksa `env.STORE_BACKEND` (default 'shopify'). Admin'den anında değişir (redeploy gerekmez).
 */
export async function getStore(): Promise<StoreAdapter> {
  const backend = await getActiveStoreBackend();
  return backend === 'native' ? nativeStoreAdapter : shopifyStoreAdapter;
}
