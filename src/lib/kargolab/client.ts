/**
 * KargoLab API Client (public façade).
 * Internal auth/fetch internal.ts'de.
 * Shipment & address fonksiyonları shipments.ts'de.
 */
import { authFetch, getToken, KargoLabError } from './internal';

export { KargoLabError };

export interface KargoLabHealth {
  ok: boolean;
  userId: number;
  memberId: number;
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
