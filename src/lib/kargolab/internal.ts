/**
 * KargoLab internal HTTP helpers (auth + token cache).
 * Public API'ler client.ts ve shipments.ts üstünden açılır.
 */
import { env } from '../env';

interface CachedToken {
  token: string;
  userId: number;
  memberId: number;
  expiresAt: number;
}

let cached: CachedToken | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000;

export class KargoLabError extends Error {
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
    throw new KargoLabError(
      data.status ?? 500,
      data,
      data.message ?? 'KargoLab login response malformed',
    );
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

export async function getToken(): Promise<CachedToken> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  return signIn();
}

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

export async function authFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token } = await getToken();
  const url = path.startsWith('http') ? path : `${env.KARGOLAB_API_URL}${path}`;

  const doRequest = (bearer: string) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${bearer}`,
        Host: env.KARGOLAB_HOST_HEADER,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
    });

  let res = await doRequest(token);

  if (res.status === 401 || res.status === 403) {
    cached = null;
    const fresh = await signIn();
    res = await doRequest(fresh.token);
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
