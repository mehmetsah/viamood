/**
 * Trendyol Product Integration API istemcisi (public façade).
 *
 * Kimlik bilgileri parametreyle gelir (env'e bağlı DEĞİL) — böylece çoklu tedarikçi
 * (Halil İbrahim, test mağazası member_id=30 vb.) aynı istemciyle çekilir.
 *
 * Sözleşme (KargoLab IntegrationStockSyncService.php'den doğrulandı):
 *   GET https://apigw.trendyol.com/integration/product/sellers/{supplierId}/products?page=0&size=200
 *   Authorization: Basic base64(apiKey:secretKey)
 *   User-Agent: {supplierId} - <etiket>
 */
import { normalizeTrendyolRow } from './normalize';
import type { TrendyolCredentials, TrendyolProduct, TrendyolRawRow } from './types';

const PRODUCT_API_BASE = 'https://apigw.trendyol.com/integration/product/sellers';

export class TrendyolError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TrendyolError';
    this.status = status;
  }
}

export interface FetchProductsOptions {
  /** Sayfa boyutu (Trendyol üst sınır 200). */
  pageSize?: number;
  /** Güvenlik sınırı — sonsuz döngü koruması. */
  maxPages?: number;
  /** Sadece onaylı (yayında) ürünler. */
  approvedOnly?: boolean;
  /** User-Agent etiketi (Trendyol supplierId ile birleştirir). */
  userAgentLabel?: string;
  signal?: AbortSignal;
  /** Her sayfa çekildikçe ilerleme callback'i. */
  onPage?: (page: number, count: number, total: number) => void;
}

function authHeaders(creds: TrendyolCredentials, label: string): Record<string, string> {
  const auth = Buffer.from(`${creds.apiKey}:${creds.secretKey}`).toString('base64');
  return {
    Authorization: `Basic ${auth}`,
    'User-Agent': `${creds.supplierId} - ${label}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/** Trendyol yanıt gövdesinden satır dizisini çıkarır (content/data/items/düz dizi). */
export function extractRows(body: unknown): TrendyolRawRow[] {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.content)) return b.content as TrendyolRawRow[];
    if (Array.isArray(b.data)) return b.data as TrendyolRawRow[];
    if (Array.isArray(b.items)) return b.items as TrendyolRawRow[];
  }
  if (Array.isArray(body)) return body as TrendyolRawRow[];
  return [];
}

/** Hata gövdesinden okunabilir mesaj çıkarır. */
export function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (b.message) return String(b.message);
    const errs = b.errors;
    if (Array.isArray(errs) && errs[0] && typeof errs[0] === 'object') {
      const m = (errs[0] as Record<string, unknown>).message;
      if (m) return String(m);
    }
    if (b.error) return String(b.error);
  }
  if (typeof body === 'string') return body.slice(0, 300);
  return '';
}

/**
 * Bir Trendyol satıcısının tüm ürünlerini sayfalayarak çeker ve normalize eder.
 * Salt-okuma — hiçbir yere yazmaz.
 */
export async function fetchTrendyolProducts(
  creds: TrendyolCredentials,
  opts: FetchProductsOptions = {},
): Promise<TrendyolProduct[]> {
  if (!creds.supplierId || !creds.apiKey || !creds.secretKey) {
    throw new TrendyolError('Trendyol için supplierId, apiKey ve secretKey zorunludur.', 422);
  }

  const size = Math.min(Math.max(opts.pageSize ?? 200, 1), 200);
  const maxPages = opts.maxPages ?? 50;
  const label = opts.userAgentLabel ?? 'ViaMoodProductSync';
  const headers = authHeaders(creds, label);
  const base = `${PRODUCT_API_BASE}/${encodeURIComponent(creds.supplierId)}/products`;

  const products: TrendyolProduct[] = [];

  for (let page = 0; page < maxPages; page++) {
    const url = `${base}?page=${page}&size=${size}${opts.approvedOnly ? '&approved=true' : ''}`;
    const res = await fetch(url, { method: 'GET', headers, signal: opts.signal });

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      const msg =
        extractErrorMessage(body) ||
        (res.status === 403
          ? 'Yetki reddedildi — supplierId/apiKey/secretKey eşleşmesini ve Trendyol yetkilerini kontrol edin.'
          : `Trendyol ürün API HTTP ${res.status}`);
      throw new TrendyolError(msg, res.status);
    }

    const rows = extractRows(body);
    if (rows.length === 0) break;

    for (const row of rows) products.push(normalizeTrendyolRow(row));
    opts.onPage?.(page, rows.length, products.length);

    // Son sayfa: dolu bir sayfadan az geldiyse devam etme.
    if (rows.length < size) break;
  }

  return products;
}
