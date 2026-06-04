/**
 * KargoLab Fiyat Sorgu (member-price-check)
 *
 * Gerçek kuryer fiyatlarını KargoLab'dan çeker. Cache 1 saat — aynı paket
 * boyutu için tekrar tekrar API çağırılmaz.
 *
 * KargoLab response: kuryer listesi (PTT, SÜRAT, MNG, Yurtiçi vs.) her birinin
 * fiyatı TRY olarak. Biz en ucuzunu (veya admin'in seçtiği kuryer'i) baz alırız.
 */
import { authFetch, KargoLabError } from './internal';

export interface QuoteInput {
  /** Brüt ağırlık (gr) — paketin gerçek tartısı */
  weightGrams: number;
  /** Paket boyutları (cm) — desi hesabı için */
  length?: number;
  width?: number;
  height?: number;
  /** Gönderen il */
  fromProvince?: string;
  /** Gönderen ilçe */
  fromDistrict?: string;
  /** Alıcı il */
  toProvince?: string;
  /** Alıcı ilçe */
  toDistrict?: string;
}

export interface CourierRate {
  courrierId: number;
  courrierName: string;
  /** TRY cinsinden fiyat (cent, integer) */
  priceCents: number;
  /** Chargeable weight (kg) — KargoLab'ın hesapladığı */
  cw: number;
  /** Kapıda ödeme kabul ediyor mu */
  acceptsCOD: boolean;
  /** Kart ile kapıda ödeme */
  acceptsCODCard: boolean;
  /** İade maliyeti (TRY cent) */
  returnCostCents: number;
}

export interface QuoteResult {
  ok: true;
  /** Tüm kuryerlerin fiyatları */
  rates: CourierRate[];
  /** En ucuz kuryer */
  cheapest: CourierRate;
  /** KargoLab'ın çağırdığı request_code */
  requestCode: string;
  /** Cache'den mi geldi */
  cached: boolean;
}
export interface QuoteError {
  ok: false;
  error: string;
}

interface RawKargoLabPriceCheck {
  status: number;
  request_code?: string;
  data?: Array<{
    courrier_id: number;
    courrier_name: string;
    service_type: string;
    insurance: number;
    accept_door_payments: number;
    accept_door_payments_card: number;
    return_cost: string;
    price: string;
    currency: string;
    cw: number;
  }>;
  message?: string;
}

const VARSAYILAN_GONDEREN = {
  city: 'İstanbul',
  state: 'Kadıköy',
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat
const cache = new Map<string, { at: number; result: QuoteResult }>();

function makeKey(input: QuoteInput): string {
  return [
    Math.round(input.weightGrams ?? 0),
    Math.round(input.length ?? 0),
    Math.round(input.width ?? 0),
    Math.round(input.height ?? 0),
    input.fromProvince ?? '',
    input.toProvince ?? '',
  ].join('|');
}

/**
 * Gerçek KargoLab rate'ini çek. Cache'liyse onu döner.
 *
 * KargoLab API'si yurtiçi (TR→TR) için çalışır. Yurtdışı şu an kapalı.
 */
export async function quoteShipmentRate(
  input: QuoteInput,
): Promise<QuoteResult | QuoteError> {
  // 0) Validate weight
  const weightKg = (input.weightGrams ?? 0) / 1000;
  if (weightKg <= 0) {
    return { ok: false, error: 'Geçersiz ağırlık' };
  }

  // 1) Cache hit?
  const key = makeKey(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.result, cached: true };
  }

  // 2) Build request — KargoLab expects 'cw' (chargeable weight kg) OR 'dimensions'
  const body: Record<string, unknown> = {
    origin: 'TR',
    destination: 'TR',
    cw: weightKg,
    addresses: {
      sender: {
        country: 'TR',
        city: input.fromProvince ?? VARSAYILAN_GONDEREN.city,
        state: input.fromDistrict ?? VARSAYILAN_GONDEREN.state,
      },
      receiver: {
        country: 'TR',
        city: input.toProvince ?? 'İstanbul',
        state: input.toDistrict ?? 'Kadıköy',
      },
    },
  };
  if (input.length && input.width && input.height) {
    body.dimensions = [
      {
        length: input.length,
        width: input.width,
        height: input.height,
        weight: weightKg,
      },
    ];
  }

  // 3) Call KargoLab
  let resp: RawKargoLabPriceCheck;
  try {
    resp = await authFetch<RawKargoLabPriceCheck>('/member-price-check', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof KargoLabError) {
      return { ok: false, error: `KargoLab API ${err.status}` };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'KargoLab error' };
  }

  if (resp.status !== 200 || !Array.isArray(resp.data)) {
    return {
      ok: false,
      error: resp.message ?? `KargoLab response status ${resp.status}`,
    };
  }

  // 4) Map to typed rates
  const rates: CourierRate[] = resp.data.map((r) => ({
    courrierId: r.courrier_id,
    courrierName: r.courrier_name,
    priceCents: Math.round(parseFloat(r.price) * 100),
    cw: r.cw,
    acceptsCOD: r.accept_door_payments === 1,
    acceptsCODCard: r.accept_door_payments_card === 1,
    returnCostCents: Math.round(parseFloat(r.return_cost) * 100),
  }));

  if (rates.length === 0) {
    return { ok: false, error: 'KargoLab fiyat dönmedi' };
  }

  // 5) Find cheapest
  const cheapest = rates.reduce((a, b) => (a.priceCents <= b.priceCents ? a : b));

  const result: QuoteResult = {
    ok: true,
    rates,
    cheapest,
    requestCode: resp.request_code ?? '',
    cached: false,
  };

  cache.set(key, { at: Date.now(), result });
  return result;
}

/**
 * Sadece en ucuz fiyatı dön — bundle-service ve diğer içsel hesaplamalar için.
 * KargoLab başarısızsa fallback: hardcoded formül (30 TL base + 50 TL/kg).
 */
export async function quoteCheapestShippingCents(input: QuoteInput): Promise<{
  priceCents: number;
  courrier: string | null;
  source: 'kargolab' | 'fallback';
}> {
  const r = await quoteShipmentRate(input);
  if (r.ok) {
    return {
      priceCents: r.cheapest.priceCents,
      courrier: r.cheapest.courrierName,
      source: 'kargolab',
    };
  }
  // Fallback: 30 TL base + 50 TL/kg
  const kg = (input.weightGrams ?? 0) / 1000;
  const fallback = Math.max(3000, 3000 + Math.round(kg * 5000));
  return { priceCents: fallback, courrier: null, source: 'fallback' };
}
