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
import {
  createStorefrontOrder,
  type StorefrontOrderBody,
  type StorefrontPaymentMethod,
  type CreatedOrder,
  type OrderErr,
} from '../shopify/create-storefront-order';
import { upsertCustomerAddress, type CustomerAddressInput } from '../shopify/customer-address';

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
 * Aktif store backend'ini döndürür. Şimdilik tek backend (shopify).
 * İleride: process.env.STORE_BACKEND === 'native' → nativeStoreAdapter.
 */
export function getStore(): StoreAdapter {
  return shopifyStoreAdapter;
}
