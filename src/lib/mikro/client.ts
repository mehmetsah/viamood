/**
 * Mikro V17 ERP API client.
 *
 * Auth: POST /Login/Authenticate → JWT (Bearer, 24h)
 * Token in-memory cache (50dk TTL — refresh edge'i için 24h - 50dk margin).
 *
 * Tüm istekler: Bearer Authorization header + Content-Type: application/json
 */
import { env } from '../env';

interface CachedToken {
  token: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 saat — 24h limitinden önce yenile
let cached: CachedToken | null = null;

export class MikroError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `Mikro API error: ${status}`);
    this.name = 'MikroError';
  }
}

async function login(): Promise<CachedToken> {
  if (!env.MIKRO_API_URL || !env.MIKRO_USERNAME || !env.MIKRO_PASSWORD) {
    throw new Error('MIKRO_API_URL / MIKRO_USERNAME / MIKRO_PASSWORD env\'de set edilmemiş');
  }
  const res = await fetch(`${env.MIKRO_API_URL}/Login/Authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Username: env.MIKRO_USERNAME,
      Password: env.MIKRO_PASSWORD,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new MikroError(res.status, body, 'Mikro login başarısız');
  }
  // Response direkt JWT string'i — JSON encoded
  const raw = await res.text();
  // "ey..." kabuk tırnaklarını temizle
  const token = raw.trim().replace(/^"|"$/g, '');

  if (!token.startsWith('ey')) {
    throw new MikroError(200, raw, 'Mikro: beklenmedik token formatı');
  }
  cached = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return cached;
}

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const fresh = await login();
  return fresh.token;
}

interface FetchOpts extends Omit<RequestInit, 'headers' | 'body'> {
  body?: unknown;
  headers?: Record<string, string>;
}

export async function mikroFetch<T = unknown>(
  path: string,
  options: FetchOpts = {},
): Promise<T> {
  let token = await getToken();
  const url = path.startsWith('http') ? path : `${env.MIKRO_API_URL}${path}`;

  const doRequest = (bearer: string) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await doRequest(token);

  // 401 → token expire olmuş, yenile + retry
  if (res.status === 401) {
    cached = null;
    token = await getToken();
    res = await doRequest(token);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new MikroError(res.status, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

/** Bağlantı sağlık kontrolü — login eder, token döner. */
export async function mikroHealthCheck(): Promise<{ ok: boolean; tokenPrefix?: string; error?: string }> {
  try {
    const t = await getToken();
    return { ok: true, tokenPrefix: t.slice(0, 24) + '…' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

/** Cache'i sıfırla — test/dev için */
export function invalidateMikroCache(): void {
  cached = null;
}
