/**
 * KargoLab shipment API wrappers.
 *
 * Akış (vendor için):
 *   1. (Bir kere) Sender address yarat → kargolab_address_id sakla
 *   2. Order line item için createShipment(...) çağır → shipment_id + barcode
 *   3. getLabel(shipmentId) → PDF/URL
 *   4. trackByBarcode(barcode) → mevcut event'ler
 */
import { authFetch } from './internal';

// ============================================================================
// Types
// ============================================================================

export interface KargoLabAddress {
  contact_name: string;
  company_name?: string;
  address1: string;
  address2?: string;
  address_description?: string;
  zipcode: string;
  town: string;       // İlçe / Mahalle
  city: string;       // İlçe (KargoLab'ın city = district mantığı)
  state: string;      // İl
  state_code?: string;
  country: string;    // 'TR'
  email?: string;
  phone: string;
}

export interface AddressCreateInput extends KargoLabAddress {
  /** 1 = sender (gönderen), 2 = receiver (alıcı) */
  address_type: 1 | 2;
  /** 1 = default, 2 = non-default */
  default?: 1 | 2;
}

interface AddressCreateResponse {
  status: number;
  data?: { id?: number; address?: { id?: number } } | unknown;
  message?: string;
}

export async function createKargoLabAddress(
  input: AddressCreateInput,
): Promise<{ ok: true; addressId: number } | { ok: false; error: string }> {
  try {
    const res = await authFetch<AddressCreateResponse>('/address', {
      method: 'POST',
      body: JSON.stringify({
        default: 2,
        ...input,
      }),
    });
    if (res.status !== 200 && res.status !== 201) {
      return { ok: false, error: res.message ?? `KargoLab address error: ${res.status}` };
    }
    const id =
      (res.data as { id?: number; address?: { id?: number } } | undefined)?.id ??
      (res.data as { address?: { id?: number } } | undefined)?.address?.id;
    if (!id) return { ok: false, error: 'address response içinde id yok' };
    return { ok: true, addressId: id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

interface AddressGetResponse {
  status: number;
  data?: Array<{
    id: number;
    contact_name?: string;
    company_name?: string;
    city?: string;
    state?: string;
    address_type: number;
    default?: number;
  }>;
}

export interface ExistingAddress {
  id: number;
  contact_name?: string;
  company_name?: string;
  city?: string;
  state?: string;
  isDefault: boolean;
}

/**
 * Mevcut sender (address_type=1) adreslerini listele.
 * Yetki yok diye yeni adres yaratılamadığında fallback olarak kullanılır.
 */
export async function listSenderAddresses(): Promise<ExistingAddress[]> {
  const res = await authFetch<AddressGetResponse>('/address-get', {
    method: 'POST',
    body: JSON.stringify({
      pagination: { page: 1, limit: 50 },
      param: { sql: '' },
    }),
  });
  if (res.status !== 200 || !Array.isArray(res.data)) return [];
  return res.data
    .filter((a) => a.address_type === 1)
    .map((a) => ({
      id: a.id,
      contact_name: a.contact_name,
      company_name: a.company_name,
      city: a.city,
      state: a.state,
      isDefault: a.default === 1,
    }));
}

// ============================================================================
// Shipment
// ============================================================================

export interface ShipmentCommodity {
  title: string;
  sku?: string;
  hs_code?: string;
  origin_country?: string;
  qty: string | number;
  weight: number;
  price: string | number;
  currency: string;
  total_price: number;
}

export interface ShipmentDimension {
  width: string | number;
  length: string | number;
  height: string | number;
  quantity: string | number;
  /** Gross weight (kg) */
  gw: string | number;
}

export interface ShipmentCreateInput {
  /** "PTT" | "ARAS" | "MNG" | "YURTICI" ... */
  courrier: string;
  origin?: string;       // "TR"
  destination?: string;  // "TR"
  addresses: {
    receiver?: KargoLabAddress;
    receiver_id?: number;
    sender?: KargoLabAddress;
    sender_id?: number;
  };
  commodity_description: string;
  commoduties: ShipmentCommodity[]; // ⚠ typo preserved (KargoLab API)
  dimensions: ShipmentDimension[];
  /** 1=Zarf, 2=Paket, 3=Koli, 4=Ürün */
  packaging_type: 1 | 2 | 3 | 4;
  /** 1 = sender pays */
  payment_type: 1 | 2 | 3;
  /** Kapıda ödeme tutarı (varsa) */
  payment_at_door?: number;
  insurance_value?: number;
  insurance_currency?: string;
  additional_services?: string | number;
  waybill?: string;
  platform?: number;          // 2 = website
  shipment_type?: number;     // 1 = single
  tracking_number?: string;   // referans
  customer_barcode?: string;
  order_number?: string;
  courrier_api_type?: number; // 1
}

interface ShipmentCreateResponse {
  status: number;
  tracking_number?: string;
  reference_number?: string;
  data?: {
    id?: number;
    shipment_id?: number;
    shipment?: {
      id?: number;
      barcode?: string;
      tracking_number?: string;
    };
    barcode?: string;
    tracking_number?: string;
    reference_number?: string;
  };
  courrier_api?: {
    tracking_number?: string;
    data?: { dongu?: { barkod?: string } };
  };
  validation?: { status: number; message?: string };
  message?: string;
  /** Duplicate hatasında dönen mevcut shipment */
  existing_shipment?: {
    id: number;
    ref_number?: string;
    customer_barcode?: string | null;
    order_number?: string;
    tracking_number?: string;
  };
}

export interface ShipmentCreatedOk {
  ok: true;
  shipmentId: number;
  barcode?: string;
  trackingNumber?: string;
  raw: unknown;
}
export interface ShipmentErr {
  ok: false;
  error: string;
  raw?: unknown;
}

/** KargoLab backend'i tırnak karakterlerini escape etmiyor (SQL 1064 — ürün adı
 *  "18'li ..." gönderi oluşturmayı patlattı): API'ye giden TÜM string alanlardan
 *  kırıcı karakterleri temizle. */
function sanitizeForKargoLab<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/['"`\\]/g, ' ').replace(/\s+/g, ' ').trim() as T;
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeForKargoLab(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeForKargoLab(v)]),
    ) as T;
  }
  return value;
}

export async function createKargoLabShipment(
  input: ShipmentCreateInput,
): Promise<ShipmentCreatedOk | ShipmentErr> {
  try {
    const res = await authFetch<ShipmentCreateResponse>('/shipment-create', {
      method: 'POST',
      body: JSON.stringify({
        origin: 'TR',
        destination: 'TR',
        platform: 2,
        shipment_type: 1,
        courrier_api_type: 1,
        ...sanitizeForKargoLab(input),
      }),
    });
    // Duplicate / idempotent: KargoLab "kayıt zaten var" döndüğünde mevcut id ile success ver
    if (res.existing_shipment?.id) {
      return {
        ok: true,
        shipmentId: res.existing_shipment.id,
        barcode: res.existing_shipment.tracking_number ?? res.existing_shipment.ref_number,
        trackingNumber:
          res.existing_shipment.tracking_number ?? res.existing_shipment.ref_number,
        raw: res,
      };
    }
    if (res.status !== 200 && res.status !== 201) {
      return {
        ok: false,
        error: res.validation?.message ?? res.message ?? `shipment-create error: ${res.status}`,
        raw: res,
      };
    }
    const data = res.data ?? {};
    const shipment = data.shipment ?? {};
    const id = data.shipment_id ?? data.id ?? shipment.id;
    if (!id) return { ok: false, error: 'shipment response içinde id yok', raw: res };
    const barcode =
      res.courrier_api?.data?.dongu?.barkod ??
      shipment.barcode ??
      data.barcode ??
      data.tracking_number ??
      shipment.tracking_number ??
      res.tracking_number;
    const trackingNumber =
      res.tracking_number ??
      data.tracking_number ??
      shipment.tracking_number ??
      data.reference_number ??
      res.reference_number;
    return {
      ok: true,
      shipmentId: id,
      barcode,
      trackingNumber,
      raw: res,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

// ============================================================================
// Label
// ============================================================================

interface LabelResponse {
  status: number;
  data?: {
    url?: string;
    pdf?: string;
    file_name?: string;
    base64?: string;
    [key: string]: unknown;
  };
  message?: string;
}

export interface LabelOk {
  ok: true;
  /** PDF içeriği base64 olarak döner — frontend data URL'ye çevirip aç */
  pdfBase64?: string;
  fileName?: string;
  /** Eğer KargoLab url döndürürse */
  url?: string;
  raw: unknown;
}

export async function getShipmentLabel(
  shipmentId: number,
): Promise<LabelOk | { ok: false; error: string }> {
  try {
    const res = await authFetch<LabelResponse>('/shipment-actions/label', {
      method: 'POST',
      body: JSON.stringify({ data: [String(shipmentId)] }),
    });
    if (res.status !== 200) {
      return { ok: false, error: res.message ?? `label error: ${res.status}` };
    }
    return {
      ok: true,
      pdfBase64: res.data?.pdf ?? res.data?.base64,
      fileName: res.data?.file_name,
      url: res.data?.url,
      raw: res,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

// ============================================================================
// Tracking
// ============================================================================

export interface TrackingEvent {
  status: string;
  description?: string;
  location?: string;
  occurredAt?: string;
}

interface TrackResponse {
  status: number;
  data?: {
    events?: Array<{
      status?: string;
      description?: string;
      location?: string;
      date?: string;
      occurred_at?: string;
    }>;
    [key: string]: unknown;
  };
  message?: string;
}

export async function trackByBarcode(
  barcode: string,
): Promise<{ ok: true; events: TrackingEvent[]; raw: unknown } | { ok: false; error: string }> {
  try {
    const res = await authFetch<TrackResponse>(`/track/${encodeURIComponent(barcode)}`, {
      method: 'GET',
    });
    if (res.status !== 200) {
      return { ok: false, error: res.message ?? `track error: ${res.status}` };
    }
    const events: TrackingEvent[] = (res.data?.events ?? []).map((e) => ({
      status: e.status ?? 'unknown',
      description: e.description,
      location: e.location,
      occurredAt: e.occurred_at ?? e.date,
    }));
    return { ok: true, events, raw: res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
