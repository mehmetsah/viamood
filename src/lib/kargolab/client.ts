/**
 * KargoLab API Client
 *
 * Auth flow:
 *   POST /sign-in → access_token (Bearer)
 *   Token cached in-memory for 50 minutes (KargoLab JWT yaklaşık 1h yaşar)
 *
 * Doc: KargoLab postman collection (~/Downloads/KargoLab.postman_collection_last.json)
 *
 * Bütün isteklerde `Host: kargolab.com` header'ı şart — backend system_number'ı
 * Host header'dan resolve eder.
 */
import { env } from '../env';

interface CachedToken {
  token: string;
  userId: number;
  memberId: number;
  expiresAt: number;
}

let cached: CachedToken | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 dakika

class KargoLabError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `KargoLab API error: ${status}`);
    this.name = 'KargoLabError';
  }
}

async function signIn(): Promise<CachedToken> {
  if (!env.KARGOLAB_USER_EMAIL || !env.KARGOLAB_USER_PASSWORD) {
    throw new Error('KARGOLAB_USER_EMAIL ve KARGOLAB_USER_PASSWORD set edilmemiş');
  }

  const res = await fetch(`${env.KARGOLAB_API_URL}/sign-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: env.KARGOLAB_HOST_HEADER,
    },
    body: JSON.stringify({
      email: env.KARGOLAB_USER_EMAIL,
      password: env.KARGOLAB_USER_PASSWORD,
      logged: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new KargoLabError(res.status, body, 'KargoLab login başarısız');
  }

  const data = (await res.json()) as {
    status: number;
    access_token?: string;
    user?: { id: number; member?: { id: number } };
    message?: string;
  };

  if (data.status !== 200 || !data.access_token || !data.user) {
    throw new KargoLabError(data.status ?? 500, data, data.message ?? 'KargoLab login response malformed');
  }

  const token: CachedToken = {
    token: data.access_token,
    userId: data.user.id,
    memberId: data.user.member?.id ?? 0,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  cached = token;
  return token;
}

async function getToken(): Promise<CachedToken> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  return signIn();
}

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

async function authFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token } = await getToken();
  const url = path.startsWith('http') ? path : `${env.KARGOLAB_API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Host: env.KARGOLAB_HOST_HEADER,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    // Token expired — refresh
    cached = null;
    const fresh = await signIn();
    const retry = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${fresh.token}`,
        Host: env.KARGOLAB_HOST_HEADER,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
    });
    if (!retry.ok) {
      const body = await retry.text();
      throw new KargoLabError(retry.status, body);
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new KargoLabError(res.status, body);
  }

  return res.json() as Promise<T>;
}

// ============================================================================
// API methods
// ============================================================================

export interface KargoLabHealth {
  ok: boolean;
  userId: number;
  memberId: number;
  memberName?: string;
}

export async function healthCheck(): Promise<KargoLabHealth> {
  const { userId, memberId } = await getToken();
  return { ok: true, userId, memberId };
}

export interface BootstrapResponse {
  status: number;
  data?: unknown;
}

export async function bootstrap(): Promise<BootstrapResponse> {
  return authFetch<BootstrapResponse>('/bootstrap', { method: 'GET' });
}

// Shipment / address / tracking endpoint'leri Phase 4'te eklenecek.
// Şimdilik temel auth + sağlık testi yeterli.

export { KargoLabError };
